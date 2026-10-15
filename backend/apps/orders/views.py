from django.db.models import Prefetch
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
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


class OrderViewSet(
    BranchScopedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Orders of the active branch. Orders are never deleted; they are cancelled.

    `?status=pending,preparing` filters by one or more statuses.
    """

    permission_classes = [IsBranchMember]
    queryset = Order.objects.select_related("customer", "created_by")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            statuses = [s for s in self.request.query_params.get("status", "").split(",") if s]
            valid = [s for s in statuses if s in OrderStatus.values]
            if statuses:
                queryset = queryset.filter(status__in=valid)
        else:
            queryset = queryset.prefetch_related(
                "items",
                Prefetch(
                    "status_events",
                    queryset=OrderStatusEvent.objects.select_related("changed_by"),
                ),
            )
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
        """Advance to the next status (FR-28). Optional `to_status` guards against stale UIs."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.advance_order(
            self.get_object(), user=request.user, to_status=serializer.validated_data.get("to_status")
        )
        return self._detail_response(order)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.cancel_order(
            self.get_object(), user=request.user, reason=serializer.validated_data["reason"]
        )
        return self._detail_response(order)
