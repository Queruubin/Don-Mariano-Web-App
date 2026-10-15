from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from apps.users.auth import user_can_authenticate


class ActiveUserJWTAuthentication(JWTAuthentication):
    """Rejects tokens of users (or branches) deactivated after the token was issued."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user_can_authenticate(user):
            raise AuthenticationFailed("Usuario o sede inactivos.", code="user_inactive")
        return user
