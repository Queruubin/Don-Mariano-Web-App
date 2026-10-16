"""Real-time order events (PRD FR-30).

Domain commands call `emit` inside their transaction; the event is built and
published only after the transaction commits, so a rolled-back change is never
announced. Publishing problems are logged and never reach the caller.
"""

import json
import logging
import uuid

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework.renderers import JSONRenderer

from apps.realtime.publish import publish_to_branch

logger = logging.getLogger(__name__)

ORDER_CREATED = "order.created"
ORDER_UPDATED = "order.updated"
ORDER_STATUS_CHANGED = "order.status_changed"
ORDER_CANCELLED = "order.cancelled"


def build_event(order_id: int, event_type: str, *, actor_id, extra: dict) -> tuple[int, dict]:
    """Return the branch id and the event, with the board's list representation of the order."""
    # Imported here: serializers import services, which import this module.
    from apps.orders.models import Order
    from apps.orders.serializers import OrderListSerializer

    order = (
        Order.objects.select_related("customer", "created_by")
        .annotate(item_count=Count("items"))
        .get(pk=order_id)
    )
    data = json.loads(JSONRenderer().render(OrderListSerializer(order).data))
    event = {
        "type": event_type,
        "event_id": uuid.uuid4().hex,
        "sent_at": timezone.now().isoformat(),
        "actor_id": actor_id,
        "branch_id": order.branch_id,
        "order": data,
        **extra,
    }
    return order.branch_id, event


def emit(order, event_type: str, *, actor=None, **extra) -> None:
    order_id = order.pk
    actor_id = getattr(actor, "pk", None)

    def _publish():
        try:
            branch_id, event = build_event(order_id, event_type, actor_id=actor_id, extra=extra)
        except Exception:
            logger.exception("Could not build %s for order %s", event_type, order_id)
            return
        publish_to_branch(branch_id, event)

    transaction.on_commit(_publish, robust=True)
