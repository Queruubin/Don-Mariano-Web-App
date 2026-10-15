"""Branch scoping for branch-owned resources (PRD FR-2, FR-3).

Every branch-scoped view resolves exactly one *active branch* per request:

- branch admins and staff always act in their own branch;
- super admins must pick one with the `X-Branch-Id` header (or `?branch=`).

Querysets are then filtered by that branch, so objects of another branch are
simply not found (HTTP 404) instead of being forbidden.
"""

from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.branches.models import Branch

BRANCH_HEADER = "X-Branch-Id"
BRANCH_QUERY_PARAM = "branch"


def resolve_active_branch(request) -> Branch:
    user = request.user
    if not user.is_super_admin:
        if user.branch is None or not user.branch.is_active:
            raise PermissionDenied("Su usuario no tiene una sede activa asignada.")
        return user.branch

    raw = request.headers.get(BRANCH_HEADER) or request.query_params.get(BRANCH_QUERY_PARAM)
    if not raw:
        raise ValidationError(
            {"branch": [f"Seleccione una sede (encabezado {BRANCH_HEADER})."]},
            code="branch_required",
        )
    try:
        branch_id = int(raw)
    except (TypeError, ValueError):
        raise ValidationError({"branch": ["La sede seleccionada no es válida."]}) from None

    branch = Branch.objects.filter(pk=branch_id, is_active=True).first()
    if branch is None:
        raise ValidationError({"branch": ["La sede seleccionada no existe o está inactiva."]})
    return branch


class BranchScopedMixin:
    """Mixin for DRF generic views/viewsets over a branch-owned model.

    Resolves the active branch after authentication and permission checks,
    filters the queryset by it and exposes it to serializers via context.
    """

    branch_field = "branch"
    active_branch: Branch

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.active_branch = resolve_active_branch(request)

    def get_queryset(self):
        return super().get_queryset().filter(**{self.branch_field: self.active_branch})

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["branch"] = getattr(self, "active_branch", None)
        return context
