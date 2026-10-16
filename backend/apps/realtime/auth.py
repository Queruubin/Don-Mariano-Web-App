"""Socket authentication. Same rules as the HTTP API (FR-2, FR-4)."""

from dataclasses import dataclass

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.branches.models import Branch
from apps.realtime.protocol import CLOSE_AUTH_FAILED, CLOSE_FORBIDDEN
from apps.users.auth import user_can_authenticate
from apps.users.authentication import ActiveUserJWTAuthentication
from apps.users.models import User


class SocketAuthError(Exception):
    def __init__(self, close_code: int):
        super().__init__(close_code)
        self.close_code = close_code


@dataclass(frozen=True)
class SocketIdentity:
    user_id: int
    branch_id: int
    expires_at: float  # Unix time of the access token's `exp`.


def authenticate_socket(token, branch_id) -> SocketIdentity:
    """Validate the access token and resolve the one branch this socket may follow.

    Raises `SocketAuthError` with the close code to use.
    """
    if not isinstance(token, str) or not token:
        raise SocketAuthError(CLOSE_AUTH_FAILED)
    authentication = ActiveUserJWTAuthentication()
    try:
        validated = authentication.get_validated_token(token)
        user = authentication.get_user(validated)
    except (InvalidToken, TokenError, AuthenticationFailed):
        raise SocketAuthError(CLOSE_AUTH_FAILED) from None

    return SocketIdentity(
        user_id=user.pk,
        branch_id=_resolve_branch_id(user, branch_id),
        expires_at=float(validated["exp"]),
    )


def _resolve_branch_id(user: User, requested) -> int:
    if not user.is_super_admin:
        # user_can_authenticate already guaranteed an active branch.
        return user.branch_id
    if isinstance(requested, bool) or not isinstance(requested, int):
        raise SocketAuthError(CLOSE_FORBIDDEN)
    if not Branch.objects.filter(pk=requested, is_active=True).exists():
        raise SocketAuthError(CLOSE_FORBIDDEN)
    return requested


def still_allowed(user_id: int, branch_id: int) -> bool:
    """Re-check a live connection: the user or the branch may have been deactivated."""
    user = User.objects.select_related("branch").filter(pk=user_id).first()
    if not user_can_authenticate(user):
        return False
    if user.is_super_admin:
        return Branch.objects.filter(pk=branch_id, is_active=True).exists()
    return user.branch_id == branch_id
