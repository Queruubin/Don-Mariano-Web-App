import asyncio
import json
import logging
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.realtime import protocol
from apps.realtime.auth import SocketAuthError, authenticate_socket, still_allowed
from apps.realtime.protocol import branch_group, setting

logger = logging.getLogger(__name__)


class BranchConsumer(AsyncJsonWebsocketConsumer):
    """One socket following the order events of one branch. See `protocol` for the messages."""

    async def connect(self):
        self.user_id = None
        self.branch_id = None
        self.group = None
        self.expires_at = 0.0
        now = time.monotonic()
        self.opened_at = now
        self.last_seen = now
        self.last_validated = now
        self.closing = False
        await self.accept()
        self.supervisor = asyncio.create_task(self._supervise())

    async def disconnect(self, code):
        supervisor = getattr(self, "supervisor", None)
        if supervisor is not None and supervisor is not asyncio.current_task():
            supervisor.cancel()
        if self.group is not None:
            try:
                await self.channel_layer.group_discard(self.group, self.channel_name)
            except Exception:
                logger.warning("Could not leave group %s", self.group, exc_info=True)
            self.group = None

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        self.last_seen = time.monotonic()
        try:
            content = json.loads(text_data) if text_data else None
        except ValueError:
            content = None
        if not isinstance(content, dict):
            await self._close(protocol.CLOSE_PROTOCOL_ERROR)
            return
        await self.receive_json(content)

    async def receive_json(self, content, **kwargs):
        kind = content.get("type")
        if kind == protocol.MSG_PING:
            await self.send_json({"type": protocol.MSG_PONG})
        elif kind == protocol.MSG_AUTH and self.group is None:
            await self._authenticate(content)
        elif kind == protocol.MSG_AUTH or self.group is None:
            # A second auth, or anything but auth/ping before authenticating.
            await self._close(protocol.CLOSE_PROTOCOL_ERROR)
        # Other messages after authenticating are ignored (forward compatible).

    async def branch_event(self, message):
        # Defense in depth: a socket only ever forwards events of its own branch.
        if message.get("branch_id") == self.branch_id and not self.closing:
            await self.send_json(message["event"])

    # --- Internals -------------------------------------------------------------

    async def _authenticate(self, content):
        try:
            identity = await database_sync_to_async(authenticate_socket)(
                content.get("token"), content.get("branch_id")
            )
        except SocketAuthError as error:
            await self._close(error.close_code)
            return

        group = branch_group(identity.branch_id)
        try:
            await self.channel_layer.group_add(group, self.channel_name)
        except Exception:
            logger.warning("Channel layer unavailable; closing socket", exc_info=True)
            await self._close(protocol.CLOSE_UNAVAILABLE)
            return

        self.user_id = identity.user_id
        self.branch_id = identity.branch_id
        self.expires_at = identity.expires_at
        self.group = group
        self.last_validated = time.monotonic()
        await self.send_json(
            {"type": protocol.MSG_AUTH_OK, "branch_id": self.branch_id, "user_id": self.user_id}
        )

    async def _close(self, code: int):
        if self.closing:
            return
        self.closing = True
        await self.close(code=code)

    async def _supervise(self):
        """Enforce the auth deadline, token expiry, heartbeat and periodic re-validation."""
        try:
            while not self.closing:
                await asyncio.sleep(setting("TICK"))
                code = await self._check()
                if code is not None:
                    await self._close(code)
                    return
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Socket supervisor failed")
            await self._close(protocol.CLOSE_UNAVAILABLE)

    async def _check(self) -> int | None:
        now = time.monotonic()
        if self.group is None:
            if now - self.opened_at >= setting("AUTH_TIMEOUT"):
                return protocol.CLOSE_AUTH_TIMEOUT
            return None
        if time.time() >= self.expires_at:
            return protocol.CLOSE_AUTH_EXPIRED
        if now - self.last_seen >= setting("IDLE_TIMEOUT"):
            return protocol.CLOSE_IDLE_TIMEOUT
        if now - self.last_validated >= setting("REVALIDATE_INTERVAL"):
            self.last_validated = now
            if not await database_sync_to_async(still_allowed)(self.user_id, self.branch_id):
                return protocol.CLOSE_AUTH_FAILED
        return None
