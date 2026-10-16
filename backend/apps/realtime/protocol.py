"""WebSocket protocol for `/ws/branch/` (PRD FR-30).

1. The client opens the socket. The token never goes in the URL (URLs end up in logs).
2. Within `AUTH_TIMEOUT` seconds it sends
   `{"type": "auth", "token": "<access token>", "branch_id": <id or null>}`.
   Branch users always join their own branch (`branch_id` is ignored);
   super admins must send an active branch id.
3. The server answers `{"type": "auth.ok", "branch_id": ..., "user_id": ...}`
   and from then on pushes order events of that branch only.
4. The client sends `{"type": "ping"}` periodically; the server answers
   `{"type": "pong"}`. A silent connection is closed after `IDLE_TIMEOUT`.

Close codes tell the client whether and how to retry.
"""

from django.conf import settings

# Malformed message, or a message other than auth/ping before authenticating.
CLOSE_PROTOCOL_ERROR = 4400
# Invalid token, or user/branch inactive. Refresh the token, then retry once.
CLOSE_AUTH_FAILED = 4401
# Authenticated but not allowed in that branch (e.g. super admin without a valid branch).
# Do not retry until the branch changes.
CLOSE_FORBIDDEN = 4403
# No auth message arrived in time. Retry with backoff.
CLOSE_AUTH_TIMEOUT = 4408
# The access token expired while connected. Refresh and reconnect right away.
CLOSE_AUTH_EXPIRED = 4419
# No message (ping) from the client for too long. Retry with backoff.
CLOSE_IDLE_TIMEOUT = 4002
# The server cannot reach the channel layer (Redis). Retry with backoff.
CLOSE_UNAVAILABLE = 4503

MSG_AUTH = "auth"
MSG_AUTH_OK = "auth.ok"
MSG_PING = "ping"
MSG_PONG = "pong"

DEFAULTS = {
    "AUTH_TIMEOUT": 5.0,
    "IDLE_TIMEOUT": 75.0,
    # How often a connected user and branch are re-checked (deactivation).
    "REVALIDATE_INTERVAL": 60.0,
    # Resolution of the per-connection timers.
    "TICK": 1.0,
    # Upper bound for publishing one event, so a down Redis never stalls a request.
    "PUBLISH_TIMEOUT": 2.0,
    # After a failed publish, skip publishing for this long so every request
    # during a Redis outage does not pay the timeout. Clients poll meanwhile.
    "FAILURE_COOLDOWN": 5.0,
}


def setting(name: str) -> float:
    return getattr(settings, "REALTIME", {}).get(name, DEFAULTS[name])


def branch_group(branch_id: int) -> str:
    return f"branch_{branch_id}_orders"
