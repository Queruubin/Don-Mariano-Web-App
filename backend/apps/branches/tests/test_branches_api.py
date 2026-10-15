import pytest

URL = "/api/branches/"


@pytest.mark.django_db
class TestBranchesApi:
    def test_super_admin_creates_branch(self, client_for, super_admin):
        response = client_for(super_admin).post(
            URL, {"name": "Sede Sur", "address": "Calle 50 Sur", "phone": "3009998877"}, format="json"
        )
        assert response.status_code == 201
        assert response.data["is_active"] is True

    @pytest.mark.parametrize("user_fixture", ["admin_a", "staff_a"])
    def test_branch_users_cannot_manage_branches(self, request, client_for, branch_a, user_fixture):
        client = client_for(request.getfixturevalue(user_fixture))
        assert client.get(URL).status_code == 403
        assert client.patch(f"{URL}{branch_a.pk}/", {"name": "x"}, format="json").status_code == 403

    def test_delete_deactivates_branch(self, client_for, super_admin, branch_a):
        assert client_for(super_admin).delete(f"{URL}{branch_a.pk}/").status_code == 204
        branch_a.refresh_from_db()
        assert branch_a.is_active is False
