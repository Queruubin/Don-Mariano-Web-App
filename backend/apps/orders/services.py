"""Order domain rules (PRD FR-15, FR-21/22, FR-26, FR-28, FR-29).

Views and serializers call these functions; they never change order status
or numbering on their own.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.branches.models import Branch
from apps.catalog.models import Product
from apps.common.exceptions import ConflictError, DomainError
from apps.customers.models import Customer, CustomerAddress
from apps.customers.services import upsert_address, upsert_customer, use_saved_address
from apps.orders.models import Order, OrderItem, OrderStatus, OrderStatusEvent, PaymentMethod

NEXT_STATUS = {
    OrderStatus.PENDING: OrderStatus.PREPARING,
    OrderStatus.PREPARING: OrderStatus.ON_THE_WAY,
    OrderStatus.ON_THE_WAY: OrderStatus.DELIVERED,
}
FINAL_STATUSES = frozenset({OrderStatus.DELIVERED, OrderStatus.CANCELLED})
EDITABLE_STATUSES = frozenset({OrderStatus.PENDING, OrderStatus.PREPARING})


@dataclass(frozen=True)
class ItemData:
    quantity: Decimal
    unit: str
    product: Product | None = None
    name: str = ""
    notes: str = ""


@dataclass(frozen=True)
class CustomerData:
    """Who receives the order and where.

    `address_id` picks one of the customer's saved addresses (FR-14);
    otherwise `address` is typed and saved for next time.
    """

    phone: str
    name: str
    address: str = ""
    address_notes: str = ""
    address_id: int | None = None


@dataclass
class OrderData:
    customer: CustomerData
    items: list[ItemData]
    payment_method: str
    total_amount: Decimal
    pays_with: Decimal | None = None
    notes: str = ""


# --- Pure rules -----------------------------------------------------------


def next_status(status: str) -> str | None:
    return NEXT_STATUS.get(status)


def is_editable(status: str) -> bool:
    return status in EDITABLE_STATUSES


def validate_payment(payment_method: str, total_amount: Decimal, pays_with: Decimal | None) -> None:
    if total_amount is None or total_amount <= 0:
        raise DomainError("El total debe ser mayor que cero.", field="total_amount")
    if pays_with is None:
        return
    if payment_method != PaymentMethod.CASH:
        raise DomainError(
            "\"Paga con\" solo aplica para pagos en efectivo.", field="pays_with", code="pays_with_not_cash"
        )
    if pays_with < total_amount:
        raise DomainError(
            "\"Paga con\" no puede ser menor que el total.", field="pays_with", code="pays_with_too_low"
        )


# --- Commands --------------------------------------------------------------


def next_order_number(branch: Branch) -> int:
    """Issue the next per-branch order number.

    Locks the branch row so concurrent creates in the same branch serialize;
    other branches are unaffected. Must run inside a transaction.
    """
    locked = Branch.objects.select_for_update().only("id", "last_order_number").get(pk=branch.pk)
    locked.last_order_number += 1
    locked.save(update_fields=["last_order_number"])
    return locked.last_order_number


def _create_items(order: Order, items: list[ItemData]) -> None:
    if not items:
        raise DomainError("El pedido debe tener al menos un producto.", field="items")
    OrderItem.objects.bulk_create(
        OrderItem(
            order=order,
            product=item.product,
            name_snapshot=item.product.name if item.product else " ".join(item.name.split()),
            quantity=item.quantity,
            unit=item.unit,
            notes=item.notes,
        )
        for item in items
    )


def _record_event(order: Order, from_status: str, to_status: str, user, reason: str = "") -> None:
    OrderStatusEvent.objects.create(
        order=order, from_status=from_status, to_status=to_status, changed_by=user, reason=reason
    )


def _resolve_customer(branch: Branch, data: CustomerData) -> tuple[Customer, CustomerAddress]:
    """Upsert the customer and the delivery address (FR-13..15)."""
    customer = upsert_customer(branch=branch, phone=data.phone, name=data.name)
    if data.address_id is not None:
        address = use_saved_address(
            customer=customer, address_id=data.address_id, notes=data.address_notes
        )
        if address is None:
            raise DomainError(
                "La dirección elegida no es de este cliente. Elija otra o escríbala.",
                field="address",
                code="address_not_found",
            )
        return customer, address
    if not " ".join((data.address or "").split()):
        raise DomainError("Escriba la dirección de entrega.", field="address", code="address_required")
    return customer, upsert_address(customer=customer, address=data.address, notes=data.address_notes)


@transaction.atomic
def create_order(*, branch: Branch, user, data: OrderData) -> Order:
    validate_payment(data.payment_method, data.total_amount, data.pays_with)

    customer, address = _resolve_customer(branch, data.customer)

    order = Order.objects.create(
        branch=branch,
        number=next_order_number(branch),
        customer=customer,
        address_snapshot=address.address,
        address_notes=data.customer.address_notes,
        payment_method=data.payment_method,
        total_amount=data.total_amount,
        pays_with=data.pays_with,
        notes=data.notes,
        created_by=user,
    )
    _create_items(order, data.items)
    _record_event(order, "", OrderStatus.PENDING, user)
    return order


def _lock(order: Order) -> Order:
    return Order.objects.select_for_update().get(pk=order.pk)


@transaction.atomic
def update_order(
    order: Order,
    *,
    changes: dict,
    items: list[ItemData] | None,
    customer: CustomerData | None = None,
) -> Order:
    """Edit an order while it is pending or preparing (FR-29).

    `changes` may contain address_snapshot, address_notes, payment_method,
    total_amount, pays_with and notes. When `items` is given it replaces all lines.
    When `customer` is given, the customer and delivery address are upserted
    exactly as on create and replace the order's customer and address.
    """
    order = _lock(order)
    if not is_editable(order.status):
        raise DomainError("Este pedido ya no se puede editar.", code="order_not_editable")

    if customer is not None:
        order.customer, address = _resolve_customer(order.branch, customer)
        order.address_snapshot = address.address
        order.address_notes = customer.address_notes
    for name, value in changes.items():
        setattr(order, name, value)
    if order.payment_method != PaymentMethod.CASH and "pays_with" not in changes:
        # Switching away from cash drops the "paga con" amount.
        order.pays_with = None
    validate_payment(order.payment_method, order.total_amount, order.pays_with)
    order.save()

    if items is not None:
        order.items.all().delete()
        _create_items(order, items)
    return order


STALE_STATUS_MESSAGE = "Este domicilio ya cambió de estado."


def _check_expected_status(order: Order, expected_status: str | None) -> None:
    """Reject a change made from an outdated screen (two tablets, same order)."""
    if expected_status is not None and expected_status != order.status:
        raise ConflictError(
            f"{STALE_STATUS_MESSAGE} Ahora está \"{OrderStatus(order.status).label}\".",
            code="stale_status",
            extra={"status": order.status},
        )


def _set_status(order: Order, to_status: str, *, user, reason: str = "") -> Order:
    previous = order.status
    order.status = to_status
    order.status_changed_at = timezone.now()
    fields = ["status", "status_changed_at", "updated_at"]
    if reason:
        order.cancel_reason = reason
        fields.append("cancel_reason")
    order.save(update_fields=fields)
    _record_event(order, previous, to_status, user, reason)
    return order


@transaction.atomic
def advance_order(
    order: Order, *, user, to_status: str | None = None, expected_status: str | None = None
) -> Order:
    """Move an order one step forward (FR-28).

    `to_status`, if given, must be that step. `expected_status` is the status the
    client saw; when it no longer matches, the change is rejected with HTTP 409.
    """
    order = _lock(order)
    _check_expected_status(order, expected_status)
    expected = next_status(order.status)
    if expected is None:
        raise DomainError("Este pedido ya está finalizado.", code="order_final")
    if to_status is not None and to_status != expected:
        raise DomainError(
            f"No se puede pasar de \"{OrderStatus(order.status).label}\" a "
            f"\"{OrderStatus(to_status).label}\".",
            field="to_status",
            code="invalid_transition",
        )
    return _set_status(order, expected, user=user)


@transaction.atomic
def cancel_order(order: Order, *, user, reason: str, expected_status: str | None = None) -> Order:
    reason = (reason or "").strip()
    if not reason:
        raise DomainError("Indique el motivo de la cancelación.", field="reason", code="reason_required")
    order = _lock(order)
    _check_expected_status(order, expected_status)
    if order.status in FINAL_STATUSES:
        raise DomainError("Este pedido ya está finalizado.", code="order_final")
    return _set_status(order, OrderStatus.CANCELLED, user=user, reason=reason)
