import pytest

from apps.users.models import User

URL = "/api/users/"
NEW_PASSWORD = "Otra-Clave-Segura-9"


def detail(user):
    return f"{URL}{user.pk}/"


def new_user_payload(role, branch=None, email="nuevo@test.co"):
    payload = {"email": email, "name": "Nuevo", "password": NEW_PASSWORD, "role": role}
    if branch is not None:
        payload["branch"] = branch.pk
    return payload


@pytest.mark.django_db
class TestUsersPermissionMatrix:
    def test_staff_cannot_access_users(self, client_for, staff_a):
        client = client_for(staff_a)
        assert client.get(URL).status_code == 403
        assert client.post(URL, new_user_payload("branch_staff"), format="json").status_code == 403

    def test_anonymous_is_rejected(self, client):
        assert client.get(URL).status_code == 401

    @pytest.mark.parametrize("role", ["super_admin", "branch_admin", "branch_staff"])
    def test_super_admin_creates_any_role(self, client_for, super_admin, branch_a, role):
        branch = None if role == "super_admin" else branch_a
        response = client_for(super_admin).post(URL, new_user_payload(role, branch), format="json")
        assert response.status_code == 201, response.data
        assert response.data["role"] == role
        assert response.data["branch"] == (branch.pk if branch else None)

    def test_super_admin_lists_all_users(self, client_for, super_admin, staff_a, staff_b):
        response = client_for(super_admin).get(URL)
        emails = {u["email"] for u in response.data["results"]}
        assert {staff_a.email, staff_b.email} <= emails

    def test_branch_admin_creates_staff_in_own_branch_only(self, client_for, admin_a, branch_b):
        # Even if another branch is requested, the user lands in the admin's branch.
        response = client_for(admin_a).post(
            URL, new_user_payload("branch_staff", branch_b), format="json"
        )
        assert response.status_code == 201
        assert response.data["branch"] == admin_a.branch_id

    @pytest.mark.parametrize("role", ["super_admin", "branch_admin"])
    def test_branch_admin_cannot_create_other_roles(self, client_for, admin_a, branch_a, role):
        response = client_for(admin_a).post(URL, new_user_payload(role, branch_a), format="json")
        assert response.status_code == 400
        assert "role" in response.data

    def test_branch_admin_sees_only_own_staff(
        self, client_for, admin_a, staff_a, staff_b, admin_b
    ):
        response = client_for(admin_a).get(URL)
        emails = {u["email"] for u in response.data["results"]}
        assert emails == {staff_a.email}

    def test_branch_admin_cannot_touch_other_branch_or_admins(
        self, client_for, admin_a, staff_b, admin_b, make_user, branch_a
    ):
        other_admin_same_branch = make_user("admin2.a@test.co", User.Role.BRANCH_ADMIN, branch_a)
        client = client_for(admin_a)
        for target in (staff_b, admin_b, other_admin_same_branch):
            assert client.get(detail(target)).status_code == 404
            assert client.patch(detail(target), {"name": "x"}, format="json").status_code == 404
            assert client.delete(detail(target)).status_code == 404

    def test_branch_admin_cannot_promote_staff(self, client_for, admin_a, staff_a):
        response = client_for(admin_a).patch(
            detail(staff_a), {"role": "branch_admin"}, format="json"
        )
        assert response.status_code == 400

    def test_delete_deactivates_user(self, client_for, admin_a, staff_a):
        response = client_for(admin_a).delete(detail(staff_a))
        assert response.status_code == 204
        staff_a.refresh_from_db()
        assert staff_a.is_active is False

    def test_cannot_deactivate_self(self, client_for, super_admin):
        assert client_for(super_admin).delete(detail(super_admin)).status_code == 400

    def test_admin_resets_password(self, client_for, admin_a, staff_a):
        response = client_for(admin_a).post(
            f"{detail(staff_a)}reset-password/", {"password": NEW_PASSWORD}, format="json"
        )
        assert response.status_code == 204
        staff_a.refresh_from_db()
        assert staff_a.check_password(NEW_PASSWORD)

    def test_branch_admin_cannot_reset_other_branch_password(self, client_for, admin_a, staff_b):
        response = client_for(admin_a).post(
            f"{detail(staff_b)}reset-password/", {"password": NEW_PASSWORD}, format="json"
        )
        assert response.status_code == 404
