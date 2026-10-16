"""The /ws/branch/ socket: authentication, heartbeat and branch isolation (PRD FR-2, FR-30)."""

from datetime import timedelta

import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.realtime import protocol
from apps.realtime.publish import BRANCH_EVENT
from config.asgi import application

PATH = "/ws/branch/"
ORIGIN = (b"origin", b"http://localhost:5173")

pytestmark = [pytest.mark.asyncio, pytest.mark.django_db(transaction=True)]


@pytest.fixture(autouse=True)
def flush_channel_layer():
    yield
    async_to_sync(get_channel_layer().flush)()


def access_token(user, lifetime=None) -> str:
    token = AccessToken.for_user(user)
    if lifetime is not None:
        token.set_exp(lifetime=lifetime)
    return str(token)


async def open_socket(headers=(ORIGIN,)):
    communicator = WebsocketCommunicator(application, PATH, headers=list(headers))
    connected, _ = await communicator.connect()
    assert connected
    return communicator


async def send_auth(communicator, token, branch_id=None):
    await communicator.send_json_to({"type": "auth", "token": token, "branch_id": branch_id})


async def authenticated(user, branch_id=None):
    communicator = await open_socket()
    await send_auth(communicator, access_token(user), branch_id)
    reply = await communicator.receive_json_from(timeout=2)
    assert reply["type"] == protocol.MSG_AUTH_OK
    return communicator, reply


async def close_code(communicator, timeout=2):
    message = await communicator.receive_output(timeout)
    assert message["type"] == "websocket.close"
    return message["code"]


class TestAuthentication:
    async def test_staff_joins_their_own_branch_and_ignores_branch_id(self, staff_a, branch_a, branch_b):
        communicator, reply = await authenticated(staff_a, branch_id=branch_b.pk)
        assert reply == {"type": "auth.ok", "branch_id": branch_a.pk, "user_id": staff_a.pk}
        await communicator.disconnect()

    async def test_closes_when_no_auth_message_arrives_in_time(self):
        communicator = await open_socket()
        assert await close_code(communicator) == protocol.CLOSE_AUTH_TIMEOUT

    async def test_bad_token_is_rejected(self):
        communicator = await open_socket()
        await send_auth(communicator, "not-a-jwt")
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    async def test_missing_token_is_rejected(self):
        communicator = await open_socket()
        await communicator.send_json_to({"type": "auth"})
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    async def test_refresh_token_is_not_an_access_token(self, staff_a):
        communicator = await open_socket()
        await send_auth(communicator, str(RefreshToken.for_user(staff_a)))
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    async def test_expired_token_is_rejected(self, staff_a):
        communicator = await open_socket()
        await send_auth(communicator, access_token(staff_a, lifetime=timedelta(seconds=-1)))
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    async def test_inactive_user_is_rejected(self, staff_a):
        token = access_token(staff_a)
        staff_a.is_active = False
        await database_sync_to_async(staff_a.save)()
        communicator = await open_socket()
        await send_auth(communicator, token)
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    async def test_user_of_inactive_branch_is_rejected(self, staff_a, branch_a):
        branch_a.is_active = False
        await database_sync_to_async(branch_a.save)()
        communicator = await open_socket()
        await send_auth(communicator, access_token(staff_a))
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    @pytest.mark.parametrize("branch_id", [None, "1", True, 999_999])
    async def test_super_admin_needs_a_valid_branch(self, super_admin, branch_a, branch_id):
        communicator = await open_socket()
        await send_auth(communicator, access_token(super_admin), branch_id)
        assert await close_code(communicator) == protocol.CLOSE_FORBIDDEN

    async def test_super_admin_cannot_follow_an_inactive_branch(self, super_admin, branch_a):
        branch_a.is_active = False
        await database_sync_to_async(branch_a.save)()
        communicator = await open_socket()
        await send_auth(communicator, access_token(super_admin), branch_a.pk)
        assert await close_code(communicator) == protocol.CLOSE_FORBIDDEN

    async def test_super_admin_follows_the_chosen_branch(self, super_admin, branch_b):
        communicator, reply = await authenticated(super_admin, branch_id=branch_b.pk)
        assert reply["branch_id"] == branch_b.pk
        await communicator.disconnect()

    async def test_other_messages_before_auth_are_a_protocol_error(self):
        communicator = await open_socket()
        await communicator.send_json_to({"type": "subscribe"})
        assert await close_code(communicator) == protocol.CLOSE_PROTOCOL_ERROR

    async def test_invalid_json_is_a_protocol_error(self):
        communicator = await open_socket()
        await communicator.send_to(text_data="{nope")
        assert await close_code(communicator) == protocol.CLOSE_PROTOCOL_ERROR

    async def test_second_auth_is_a_protocol_error(self, staff_a):
        communicator, _ = await authenticated(staff_a)
        await send_auth(communicator, access_token(staff_a))
        assert await close_code(communicator) == protocol.CLOSE_PROTOCOL_ERROR


class TestOrigin:
    async def test_unknown_origin_is_refused(self):
        communicator = WebsocketCommunicator(
            application, PATH, headers=[(b"origin", b"https://evil.example")]
        )
        connected, _ = await communicator.connect()
        assert not connected

    async def test_missing_origin_is_refused(self):
        communicator = WebsocketCommunicator(application, PATH)
        connected, _ = await communicator.connect()
        assert not connected


class TestConnectionLifetime:
    async def test_ping_pong_before_and_after_auth(self, staff_a):
        communicator = await open_socket()
        await communicator.send_json_to({"type": "ping"})
        assert await communicator.receive_json_from(timeout=1) == {"type": "pong"}
        await send_auth(communicator, access_token(staff_a))
        assert (await communicator.receive_json_from(timeout=2))["type"] == protocol.MSG_AUTH_OK
        await communicator.send_json_to({"type": "ping"})
        assert await communicator.receive_json_from(timeout=1) == {"type": "pong"}
        await communicator.disconnect()

    async def test_silent_connection_is_closed(self, staff_a):
        communicator, _ = await authenticated(staff_a)
        assert await close_code(communicator) == protocol.CLOSE_IDLE_TIMEOUT

    async def test_closes_with_auth_expired_when_the_token_expires(self, staff_a, settings):
        settings.REALTIME = {**settings.REALTIME, "IDLE_TIMEOUT": 30}
        communicator = await open_socket()
        await send_auth(communicator, access_token(staff_a, lifetime=timedelta(seconds=2)))
        assert (await communicator.receive_json_from(timeout=2))["type"] == protocol.MSG_AUTH_OK
        assert await close_code(communicator, timeout=4) == protocol.CLOSE_AUTH_EXPIRED

    async def test_deactivated_user_is_disconnected(self, staff_a, settings):
        settings.REALTIME = {**settings.REALTIME, "IDLE_TIMEOUT": 30, "REVALIDATE_INTERVAL": 0.1}
        communicator, _ = await authenticated(staff_a)
        staff_a.is_active = False
        await database_sync_to_async(staff_a.save)()
        assert await close_code(communicator) == protocol.CLOSE_AUTH_FAILED

    async def test_channel_layer_down_closes_with_unavailable(self, staff_a, monkeypatch):
        async def broken_group_add(*args, **kwargs):
            raise ConnectionError("redis is down")

        monkeypatch.setattr(get_channel_layer(), "group_add", broken_group_add)
        communicator = await open_socket()
        await send_auth(communicator, access_token(staff_a))
        assert await close_code(communicator) == protocol.CLOSE_UNAVAILABLE


class TestBranchIsolation:
    async def test_order_event_reaches_only_the_same_branch(
        self, staff_a, admin_a, staff_b, branch_a, make_order
    ):
        socket_a, _ = await authenticated(admin_a)
        socket_b, _ = await authenticated(staff_b)

        order = await database_sync_to_async(make_order)(branch_a, staff_a)

        event = await socket_a.receive_json_from(timeout=2)
        assert event["type"] == "order.created"
        assert event["order"]["id"] == order.pk
        assert event["branch_id"] == branch_a.pk
        assert event["actor_id"] == staff_a.pk
        assert await socket_b.receive_nothing(timeout=0.3)
        await socket_a.disconnect()
        await socket_b.disconnect()

    async def test_socket_never_forwards_another_branchs_message(self, staff_a, branch_a, branch_b):
        socket_a, _ = await authenticated(staff_a)
        await get_channel_layer().group_send(
            protocol.branch_group(branch_a.pk),
            {"type": BRANCH_EVENT, "branch_id": branch_b.pk, "event": {"type": "order.created"}},
        )
        assert await socket_a.receive_nothing(timeout=0.3)
        await socket_a.disconnect()
