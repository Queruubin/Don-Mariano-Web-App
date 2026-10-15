from rest_framework import viewsets

from apps.catalog.models import Product
from apps.catalog.serializers import ProductSerializer
from apps.common.permissions import IsBranchAdminOrAbove, IsBranchMember
from apps.common.scoping import BranchScopedMixin
from apps.common.text import normalize_text


def _truthy(value: str | None) -> bool:
    return (value or "").lower() in {"1", "true", "yes"}


class ProductViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """Branch catalog. Read: any branch member. Write: branch admin or above.

    `?search=` matches every word as a substring of the normalized name, so it is
    case- and accent-insensitive and matches partial words (FR-12). The trigram
    index on `normalized_name` keeps these `LIKE '%..%'` lookups fast.
    DELETE deactivates the product (FR-11).
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsBranchMember()]
        return [IsBranchAdminOrAbove()]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if self.action == "list" and not _truthy(params.get("include_inactive")):
            queryset = queryset.filter(is_active=True)
        for word in normalize_text(params.get("search", "")).split():
            queryset = queryset.filter(normalized_name__contains=word)
        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
