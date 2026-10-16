"""Publishing events to a branch group.

The real-time channel is an enhancement (PRD section 5): if the channel layer
(Redis) is down, publishing logs a warning and the caller carries on; clients
fall back to polling.
"""

import asyncio
import logging
import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from apps.realtime.protocol import branch_group, setting

logger = logging.getLogger(__name__)

# Consumers handle this message type in `branch_event`.
BRANCH_EVENT = "branch.event"

# Monotonic time until which publishing is skipped after a failure (per process).
_paused_until = 0.0


async def _group_send(layer, group: str, message: dict) -> None:
    await asyncio.wait_for(layer.group_send(group, message), timeout=setting("PUBLISH_TIMEOUT"))


def publish_to_branch(branch_id: int, event: dict) -> bool:
    """Send `event` to every socket following `branch_id`. Never raises.

    Returns whether the event was handed to the channel layer.
    """
    global _paused_until
    if time.monotonic() < _paused_until:
        return False
    try:
        layer = get_channel_layer()
        if layer is None:
            return False
        async_to_sync(_group_send)(
            layer, branch_group(branch_id), {"type": BRANCH_EVENT, "branch_id": branch_id, "event": event}
        )
        return True
    except Exception:
        cooldown = setting("FAILURE_COOLDOWN")
        _paused_until = time.monotonic() + cooldown
        logger.warning(
            "Could not publish %s to branch %s; skipping real-time events for %ss",
            event.get("type"),
            branch_id,
            cooldown,
            exc_info=True,
        )
        return False
