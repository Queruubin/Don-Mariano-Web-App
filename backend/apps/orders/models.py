from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from apps.common.units import Unit


class OrderStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    PREPARING = "preparing", "Alistando"
    ON_THE_WAY = "on_the_way", "En camino"
    DELIVERED = "delivered", "Entregado"
    CANCELLED = "cancelled", "Cancelado"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Efectivo"
    CARD = "card", "Tarjeta"
    NEQUI = "nequi", "Nequi"
    DAVIPLATA = "daviplata", "Daviplata"


class Order(models.Model):
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="orders")
    # Human-friendly sequential number per branch (FR-26).
    number = models.PositiveIntegerField(editable=False)
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="orders"
    )
    address_snapshot = models.CharField(max_length=255)
    address_notes = models.CharField(max_length=255, blank=True)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices)
    # COP has no cents in practice.
    total_amount = models.DecimalField(max_digits=12, decimal_places=0)
    pays_with = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=12, choices=OrderStatus.choices, default=OrderStatus.PENDING
    )
    cancel_reason = models.CharField(max_length=255, blank=True)
    # When the current status was reached. The board uses it to keep today's
    # delivered and cancelled orders visible.
    status_changed_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_orders"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "number"], name="order_unique_number_per_branch"),
            models.CheckConstraint(condition=Q(total_amount__gt=0), name="order_total_positive"),
            models.CheckConstraint(
                condition=Q(pays_with__isnull=True)
                | (Q(payment_method="cash") & Q(pays_with__gte=F("total_amount"))),
                name="order_pays_with_only_cash_and_covers_total",
            ),
            models.CheckConstraint(
                condition=~Q(status="cancelled") | ~Q(cancel_reason=""),
                name="order_cancel_requires_reason",
            ),
        ]
        indexes = [
            models.Index(fields=["branch", "status", "-created_at"], name="order_branch_status_idx"),
            models.Index(fields=["branch", "updated_at"], name="order_branch_updated_idx"),
        ]

    def __str__(self):
        return f"#{self.number:04d} ({self.branch_id})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    # Null for free-text items (FR-18). Products are never hard-deleted.
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="order_items",
    )
    name_snapshot = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=10, choices=Unit.choices)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "order_items"
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="order_item_quantity_positive"),
        ]

    def __str__(self):
        return f"{self.quantity} {self.unit} {self.name_snapshot}"


class OrderStatusEvent(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_events")
    # Empty for the creation event.
    from_status = models.CharField(max_length=12, choices=OrderStatus.choices, blank=True)
    to_status = models.CharField(max_length=12, choices=OrderStatus.choices)
    # The cancellation reason, for events that cancel the order.
    reason = models.CharField(max_length=255, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="order_status_events"
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "order_status_events"
        ordering = ["changed_at", "id"]

    def __str__(self):
        return f"{self.from_status or '-'} -> {self.to_status}"
