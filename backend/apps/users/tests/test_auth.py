import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from apps.users.models import User
from conftest import PASSWORD

LOGIN_URL = "/api/auth/login/"
REFRESH_URL = "/api/auth/refresh/"
ME_URL = "/api/auth/me/"


def login(email):
    return APIClient().post(LOGIN_URL, {"email": email, "password": PASSWORD}, format="json")


@pytest.mark.django_db
class TestLogin:
    def test_active_user_gets_tokens_and_me(self, staff_a):
        response = login(staff_a.email)
        assert response.status_code == 200
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        me = client.get(ME_URL)
        assert me.status_code == 200
        assert me.data["email"] == staff_a.email
        assert me.data["role"] == "branch_staff"
        assert me.data["branch"] == staff_a.branch_id

    def test_inactive_user_cannot_log_in(self, staff_a):
        staff_a.is_active = False
        staff_a.save()
        assert login(staff_a.email).status_code == 401

    def test_user_of_inactive_branch_cannot_log_in(self, staff_a, branch_a):
        branch_a.is_active = False
        branch_a.save()
        assert login(staff_a.email).status_code == 401

    def test_existing_token_stops_working_when_branch_is_deactivated(self, staff_a, branch_a):
        tokens = login(staff_a.email).data
        branch_a.is_active = False
        branch_a.save()

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        assert client.get(ME_URL).status_code == 401
        refresh = APIClient().post(REFRESH_URL, {"refresh": tokens["refresh"]}, format="json")
        assert refresh.status_code == 401

    def test_refresh_rotates_token_for_active_user(self, staff_a):
        tokens = login(staff_a.email).data
        response = APIClient().post(REFRESH_URL, {"refresh": tokens["refresh"]}, format="json")
        assert response.status_code == 200
        assert {"access", "refresh"} <= response.data.keys()


@pytest.mark.django_db
class TestUserBranchRule:
    def test_branch_role_requires_branch(self):
        with pytest.raises(ValidationError):
            User.objects.create_user(email="x@test.co", password=PASSWORD, name="X", role="branch_staff")

    def test_super_admin_cannot_have_branch(self, branch_a):
        with pytest.raises(ValidationError):
            User.objects.create_user(
                email="y@test.co", password=PASSWORD, name="Y", role="super_admin", branch=branch_a
            )

    def test_database_constraint_enforces_branch_rule(self, staff_a):
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=staff_a.pk).update(branch=None)
