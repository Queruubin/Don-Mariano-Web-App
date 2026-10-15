from rest_framework.permissions import BasePermission

from apps.users.models import User


def _role(request):
    user = request.user
    return user.role if user and user.is_authenticated else None


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == User.Role.SUPER_ADMIN


class IsBranchAdminOrAbove(BasePermission):
    def has_permission(self, request, view):
        return _role(request) in (User.Role.SUPER_ADMIN, User.Role.BRANCH_ADMIN)


class IsBranchMember(BasePermission):
    """Any authenticated role that can act inside a branch.

    Super admins act in the branch selected via `X-Branch-Id` (see scoping).
    """

    def has_permission(self, request, view):
        return _role(request) in (
            User.Role.SUPER_ADMIN,
            User.Role.BRANCH_ADMIN,
            User.Role.BRANCH_STAFF,
        )
