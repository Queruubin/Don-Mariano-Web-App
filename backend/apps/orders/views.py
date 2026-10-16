from datetime import date

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.common.permissions import IsBranchMember
from apps.common.scoping import BranchScopedMixin
from apps.orders import services
from apps.orders.models import Order, OrderStatus, OrderStatusEvent
from apps.orders.serializers import (
    CancelSerializer,
    OrderCreateSerializer,
    OrderListSerializer,
    OrderSerializer,
    OrderUpdateSerializer,
    TransitionSerializer,
)

ACTIVE_STATUSES = [s for s in OrderStatus.values if s not in services.FINAL_STATUSES]
TRUE_VALUES = {"1", "true", "yes"}


class OrderPagination(PageNumberPagination):
    """The board asks for one big page (`?page_size=200`); lists keep 20."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


def _parse_date_param(raw: str) -> date:
    try:
        parsed = parse_date(raw)
    except ValueError:
        parsed = None
    if parsed is None:
        raise ValidationError({"date": ["Fecha no válida. Use el formato AAAA-MM-DD."]})
    return parsed


def _parse_since_param(raw: str):
    # A "+" in an unencoded query string arrives as a space.
    try:
        parsed = parse_datetime(raw.strip().replace(" ", "+"))
    except ValueError:
        parsed = None
    if parsed is None:
        raise ValidationError({"since": ["Fecha y hora no válidas. Use el formato ISO 8601."]})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


class OrderViewSet(
    BranchScopedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Orders of the active branch. Orders are never deleted; they are cancelled.

    List filters (newest first):

    - `?status=pending,preparing`: one or more statuses.
    - `?active=true`: only orders that are not delivered or cancelled.
    - `?board=true`: the order board (FR-27): every active order plus the orders
      delivered or cancelled on `?date=` (default: today in the branch timezone).
    - `?date=YYYY-MM-DD` without `board`: orders created that day.
    - `?since=<ISO 8601>`: only orders changed after that moment (polling).
    """

    permission_classes = [IsBranchMember]
    pagination_class = OrderPagination
    queryset = Order.objects.select_related("customer", "created_by")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            return self._filter_list(queryset).annotate(item_count=Count("items")).order_by(
                "-created_at", "-id"
            )
        return queryset.prefetch_related(
            "items",
            Prefetch("status_events", queryset=OrderStatusEvent.objects.select_related("changed_by")),
        )

    def _filter_list(self, queryset):
        params = self.request.query_params

        statuses = [s for s in params.get("status", "").split(",") if s]
        if statuses:
            queryset = queryset.filter(status__in=[s for s in statuses if s in OrderStatus.values])

        if params.get("active", "").lower() in TRUE_VALUES:
            queryset = queryset.filter(status__in=ACTIVE_STATUSES)

        raw_date = params.get("date")
        day = _parse_date_param(raw_date) if raw_date else None
        if params.get("board", "").lower() in TRUE_VALUES:
            day = day or timezone.localdate()
            queryset = queryset.filter(
                Q(status__in=ACTIVE_STATUSES) | Q(status_changed_at__date=day)
            )
        elif day is not None:
            queryset = queryset.filter(created_at__date=day)

        raw_since = params.get("since")
        if raw_since:
            queryset = queryset.filter(updated_at__gt=_parse_since_param(raw_since))
        return queryset

    def get_serializer_class(self):
        return {
            "list": OrderListSerializer,
            "create": OrderCreateSerializer,
            "update": OrderUpdateSerializer,
            "partial_update": OrderUpdateSerializer,
            "transition": TransitionSerializer,
            "cancel": CancelSerializer,
        }.get(self.action, OrderSerializer)

    def _detail_response(self, order, status_code=status.HTTP_200_OK):
        order = self.get_queryset().get(pk=order.pk)
        serializer = OrderSerializer(order, context=self.get_serializer_context())
        return Response(serializer.data, status=status_code)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return self._detail_response(order, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return self._detail_response(order)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        """Advance to the next status (FR-28).

        Body: `to_status` (the target or "next", default "next") and
        `expected_status` (the status the client saw; a mismatch answers 409).
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.advance_order(
            self.get_object(),
            user=request.user,
            to_status=serializer.validated_data.get("to_status"),
            expected_status=serializer.validated_data.get("expected_status"),
        )
        return self._detail_response(order)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.cancel_order(
            self.get_object(),
            user=request.user,
            reason=serializer.validated_data["reason"],
            expected_status=serializer.validated_data.get("expected_status"),
        )
        return self._detail_response(order)
