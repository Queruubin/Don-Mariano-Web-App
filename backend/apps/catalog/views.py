from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.catalog import importer
from apps.catalog.models import Product
from apps.catalog.search import search_products
from apps.catalog.serializers import ProductSerializer
from apps.common.permissions import IsBranchAdminOrAbove, IsBranchMember
from apps.common.scoping import BranchScopedMixin
from apps.common.text import normalize_text

AUTOCOMPLETE_DEFAULT_LIMIT = 10
AUTOCOMPLETE_MAX_LIMIT = 50
UPLOAD_PARSERS = [MultiPartParser, FormParser]
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_TRUE = {"1", "true", "yes", "si", "sí"}
_FALSE = {"0", "false", "no"}


def _truthy(value: str | None) -> bool:
    return (value or "").lower() in _TRUE


def _parse_limit(raw: str | None) -> int:
    try:
        limit = int(raw) if raw else AUTOCOMPLETE_DEFAULT_LIMIT
    except ValueError:
        limit = AUTOCOMPLETE_DEFAULT_LIMIT
    return max(1, min(limit, AUTOCOMPLETE_MAX_LIMIT))


class ProductViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """Branch catalog. Read: any branch member. Write and import: branch admin or above.

    List filters: `?search=` (ranked, see `catalog.search`), `?category=`,
    `?is_active=true|false` (default: active only; `?include_inactive=true` lists all).
    DELETE deactivates the product (FR-11); `POST .../activate/` reactivates it.
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    read_actions = {"list", "retrieve", "autocomplete", "categories"}

    def get_permissions(self):
        if self.action in self.read_actions:
            return [IsBranchMember()]
        return [IsBranchAdminOrAbove()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        params = self.request.query_params

        is_active = (params.get("is_active") or "").lower()
        if is_active in _TRUE:
            queryset = queryset.filter(is_active=True)
        elif is_active in _FALSE:
            queryset = queryset.filter(is_active=False)
        elif not _truthy(params.get("include_inactive")):
            queryset = queryset.filter(is_active=True)

        category = params.get("category", "").strip()
        if category:
            queryset = queryset.filter(category__iexact=category)

        return search_products(queryset, params.get("search", ""))

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        product = self.get_object()
        product.is_active = True
        product.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(product).data)

    @action(detail=False, methods=["get"])
    def autocomplete(self, request):
        """Top active matches for the order cart (`?q=`, `?limit=`, default 10)."""
        query = request.query_params.get("q") or request.query_params.get("search", "")
        if not normalize_text(query):
            return Response([])
        queryset = search_products(self.get_queryset().filter(is_active=True), query)
        products = queryset[: _parse_limit(request.query_params.get("limit"))]
        return Response(self.get_serializer(products, many=True).data)

    @action(detail=False, methods=["get"])
    def categories(self, request):
        """Distinct categories of the branch, merged by normalized spelling."""
        values = (
            self.get_queryset().exclude(category="").values_list("category", flat=True).distinct()
        )
        by_key: dict[str, str] = {}
        for value in values:
            by_key.setdefault(normalize_text(value), value)
        return Response(sorted(by_key.values(), key=normalize_text))

    @action(detail=False, methods=["get"], url_path="import-template")
    def import_template(self, request):
        response = HttpResponse(importer.build_template(), content_type=XLSX_CONTENT_TYPE)
        response["Content-Disposition"] = 'attachment; filename="plantilla_productos.xlsx"'
        return response

    @action(detail=False, methods=["post"], url_path="import/preview", parser_classes=UPLOAD_PARSERS)
    def import_preview(self, request):
        preview = importer.preview_import(self.active_branch, request.FILES.get("file"))
        return Response(preview.to_dict())

    @action(detail=False, methods=["post"], url_path="import/apply", parser_classes=UPLOAD_PARSERS)
    def import_apply(self, request):
        result = importer.apply_import(self.active_branch, request.FILES.get("file"))
        return Response(result)
