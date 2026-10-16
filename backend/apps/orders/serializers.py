from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Product
from apps.common.text import normalize_phone
from apps.common.units import Unit
from apps.orders import services
from apps.orders.models import Order, OrderItem, OrderStatus, OrderStatusEvent, PaymentMethod

# --- Read ------------------------------------------------------------------


class OrderItemSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="name_snapshot")
    is_free_text = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ["id", "product", "name", "quantity", "unit", "notes", "is_free_text"]

    def get_is_free_text(self, obj) -> bool:
        return obj.product_id is None


class OrderStatusEventSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.name")

    class Meta:
        model = OrderStatusEvent
        fields = ["from_status", "to_status", "changed_by", "changed_by_name", "changed_at", "reason"]


class OrderCustomerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    phone = serializers.CharField()
    name = serializers.CharField()


class OrderSerializer(serializers.ModelSerializer):
    customer = OrderCustomerSerializer()
    items = OrderItemSerializer(many=True)
    status_events = OrderStatusEventSerializer(many=True)
    status_label = serializers.CharField(source="get_status_display")
    next_status = serializers.SerializerMethodField()
    is_editable = serializers.SerializerMethodField()
    change_due = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.name")

    class Meta:
        model = Order
        fields = [
            "id", "number", "status", "status_label", "next_status", "is_editable",
            "customer", "address_snapshot", "address_notes",
            "payment_method", "total_amount", "pays_with", "change_due",
            "notes", "cancel_reason", "items", "status_events",
            "created_by", "created_by_name", "created_at", "updated_at", "status_changed_at",
        ]
        read_only_fields = fields

    def get_next_status(self, obj) -> str | None:
        return services.next_status(obj.status)

    def get_is_editable(self, obj) -> bool:
        return services.is_editable(obj.status)

    def get_change_due(self, obj):
        if obj.pays_with is None:
            return None
        return str(obj.pays_with - obj.total_amount)


class OrderListSerializer(OrderSerializer):
    """Board card data: no items or history, just how many items there are.

    Expects the queryset to annotate `item_count`.
    """

    item_count = serializers.IntegerField(read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = [
            *(f for f in OrderSerializer.Meta.fields if f not in ("items", "status_events")),
            "item_count",
        ]
        read_only_fields = fields


# --- Write -----------------------------------------------------------------


class OrderItemInputSerializer(serializers.Serializer):
    """A cart line: a catalog product (by id) or a free-text name (FR-18)."""

    product = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    quantity = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"),
        error_messages={"min_value": "La cantidad debe ser mayor que cero."},
    )
    unit = serializers.ChoiceField(choices=Unit.choices, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")

    def validate(self, attrs):
        if not attrs.get("product") and not (attrs.get("name") or "").strip():
            raise serializers.ValidationError(
                {"name": ["Seleccione un producto o escriba su nombre."]}
            )
        return attrs


class OrderItemsField(serializers.ListField):
    child = OrderItemInputSerializer()

    def __init__(self, **kwargs):
        kwargs.setdefault("allow_empty", False)
        kwargs.setdefault(
            "error_messages", {"empty": "El pedido debe tener al menos un producto."}
        )
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        rows = super().to_internal_value(data)
        branch = self.context["branch"]
        ids = {row["product"] for row in rows if row.get("product")}
        products = {p.pk: p for p in Product.objects.filter(branch=branch, pk__in=ids)}
        missing = ids - products.keys()
        if missing:
            # Products of other branches are reported as not found (FR-2).
            raise serializers.ValidationError("Uno o más productos no existen en esta sede.")

        items = []
        for row in rows:
            product = products.get(row.get("product")) if row.get("product") else None
            unit = row.get("unit") or (product.default_unit if product else Unit.UNIDAD)
            items.append(
                services.ItemData(
                    product=product,
                    name=row.get("name", ""),
                    quantity=row["quantity"],
                    unit=unit,
                    notes=row.get("notes", ""),
                )
            )
        return items


def _required_messages(message: str) -> dict[str, str]:
    return {"blank": message, "required": message, "null": message}


class OrderCustomerInputSerializer(serializers.Serializer):
    """Customer block of the order form: a saved address (`address_id`) or a typed one."""

    phone = serializers.CharField(
        max_length=30,
        error_messages=_required_messages("Escriba el teléfono del cliente."),
    )
    name = serializers.CharField(
        max_length=150,
        error_messages=_required_messages("Escriba el nombre del cliente."),
    )
    address = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    address_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    address_notes = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if len(phone) < 7:
            raise serializers.ValidationError("Ingrese un teléfono válido.")
        return phone

    def validate(self, attrs):
        if attrs.get("address_id") is None and not attrs.get("address", "").strip():
            raise serializers.ValidationError({"address": ["Escriba la dirección de entrega."]})
        return attrs


class PaymentFieldsMixin(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, min_value=Decimal("1"),
        error_messages={"min_value": "El total debe ser mayor que cero."},
    )
    pays_with = serializers.DecimalField(
        max_digits=12, decimal_places=0, required=False, allow_null=True, default=None
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class OrderCreateSerializer(PaymentFieldsMixin):
    customer = OrderCustomerInputSerializer()
    items = OrderItemsField()

    def validate(self, attrs):
        services.validate_payment(attrs["payment_method"], attrs["total_amount"], attrs["pays_with"])
        return attrs

    def create(self, validated_data):
        data = services.OrderData(
            customer=services.CustomerData(**validated_data.pop("customer")),
            **validated_data,
        )
        return services.create_order(
            branch=self.context["branch"], user=self.context["request"].user, data=data
        )


class OrderUpdateSerializer(PaymentFieldsMixin):
    customer = OrderCustomerInputSerializer(required=False)
    address_snapshot = serializers.CharField(max_length=255, required=False)
    address_notes = serializers.CharField(max_length=255, required=False, allow_blank=True)
    items = OrderItemsField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Every field is optional on update; defaults must not overwrite stored values.
        for name in ("payment_method", "total_amount", "pays_with", "notes"):
            self.fields[name].required = False
            self.fields[name].default = serializers.empty

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        customer = validated_data.pop("customer", None)
        return services.update_order(
            instance,
            changes=validated_data,
            items=items,
            customer=services.CustomerData(**customer) if customer else None,
            user=self.context["request"].user,
        )


NEXT = "next"
INVALID_STATUS_MESSAGE = "Estado no válido."


class ExpectedStatusMixin(serializers.Serializer):
    """`expected_status` is the status the client saw. A mismatch is answered with 409."""

    expected_status = serializers.ChoiceField(
        choices=OrderStatus.choices,
        required=False,
        error_messages={"invalid_choice": INVALID_STATUS_MESSAGE},
    )


class TransitionSerializer(ExpectedStatusMixin):
    """`to_status` is the target status or "next". Omitted means "next"."""

    to_status = serializers.ChoiceField(
        choices=[*OrderStatus.values, NEXT],
        required=False,
        error_messages={"invalid_choice": INVALID_STATUS_MESSAGE},
    )

    def validate_to_status(self, value):
        return None if value == NEXT else value


class CancelSerializer(ExpectedStatusMixin):
    reason = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "Indique el motivo de la cancelación.",
            "blank": "Indique el motivo de la cancelación.",
        },
    )
