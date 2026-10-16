"""Real-time order events: what is published, and only after commit (PRD FR-30)."""

import asyncio
import logging

import pytest
from django.db import transaction

from apps.orders import events
from apps.orders.models import Order, OrderStatus
from apps.realtime import publish

URL = "/api/orders/"

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def published(monkeypatch):
    """Record every event handed to the channel layer as (branch_id, event)."""
    sent = []
    monkeypatch.setattr(events, "publish_to_branch", lambda branch_id, event: sent.append((branch_id, event)))
    return sent


def detail(order_id):
    return f"{URL}{order_id}/"


class TestEventsFromTheApi:
    def test_create_publishes_order_created(self, client_for, staff_a, branch_a, order_payload, published):
        response = client_for(staff_a).post(URL, order_payload(), format="json")
        assert response.status_code == 201

        assert len(published) == 1
        branch_id, event = published[0]
        assert branch_id == branch_a.pk
        assert event["type"] == events.ORDER_CREATED
        assert event["actor_id"] == staff_a.pk
        assert event["branch_id"] == branch_a.pk
        assert event["event_id"] and event["sent_at"]
        order = event["order"]
        assert order["id"] == response.data["id"]
        assert order["number"] == response.data["number"]
        assert order["customer"]["name"] == "Gloria Pérez"
        assert order["item_count"] == 1
        assert order["status"] == OrderStatus.PENDING
        assert "items" not in order and "status_events" not in order

    def test_edit_publishes_order_updated(
        self, client_for, admin_a, staff_a, branch_a, make_order, published
    ):
        order = make_order(branch_a, staff_a)
        published.clear()

        response = client_for(admin_a).patch(detail(order.pk), {"notes": "Timbre dañado"}, format="json")

        assert response.status_code == 200
        [(_, event)] = published
        assert event["type"] == events.ORDER_UPDATED
        assert event["actor_id"] == admin_a.pk
        assert event["order"]["notes"] == "Timbre dañado"

    def test_transition_publishes_status_changed(self, client_for, staff_a, branch_a, make_order, published):
        order = make_order(branch_a, staff_a)
        published.clear()

        client_for(staff_a).post(f"{detail(order.pk)}transition/")

        [(_, event)] = published
        assert event["type"] == events.ORDER_STATUS_CHANGED
        assert event["from_status"] == OrderStatus.PENDING
        assert event["to_status"] == OrderStatus.PREPARING
        assert event["order"]["status"] == OrderStatus.PREPARING

    def test_cancel_publishes_order_cancelled(self, client_for, staff_a, branch_a, make_order, published):
        order = make_order(branch_a, staff_a)
        published.clear()

        client_for(staff_a).post(f"{detail(order.pk)}cancel/", {"reason": "No contesta"}, format="json")

        [(_, event)] = published
        assert event["type"] == events.ORDER_CANCELLED
        assert event["from_status"] == OrderStatus.PENDING
        assert event["to_status"] == OrderStatus.CANCELLED
        assert event["order"]["cancel_reason"] == "No contesta"

    def test_rejected_change_publishes_nothing(self, client_for, staff_a, branch_a, make_order, published):
        order = make_order(branch_a, staff_a)
        published.clear()

        response = client_for(staff_a).post(
            f"{detail(order.pk)}transition/", {"expected_status": OrderStatus.PREPARING}, format="json"
        )

        assert response.status_code == 409
        assert published == []


class TestOnlyAfterCommit:
    def test_nothing_is_published_until_the_transaction_commits(
        self, make_order, branch_a, staff_a, published
    ):
        with transaction.atomic():
            make_order(branch_a, staff_a)
            assert published == []
        assert [event["type"] for _, event in published] == [events.ORDER_CREATED]

    def test_rolled_back_transaction_publishes_nothing(self, make_order, branch_a, staff_a, published):
        with pytest.raises(RuntimeError), transaction.atomic():
            make_order(branch_a, staff_a)
            raise RuntimeError("boom")

        assert published == []
        assert not Order.objects.exists()


class TestPublishingFailures:
    def test_channel_layer_errors_do_not_break_the_request(
        self, client_for, staff_a, order_payload, monkeypatch, caplog
    ):
        class BrokenLayer:
            async def group_send(self, group, message):
                raise ConnectionError("redis is down")

        monkeypatch.setattr(publish, "get_channel_layer", BrokenLayer)

        with caplog.at_level(logging.WARNING, logger="apps.realtime.publish"):
            response = client_for(staff_a).post(URL, order_payload(), format="json")

        assert response.status_code == 201
        assert Order.objects.filter(pk=response.data["id"]).exists()
        assert "Could not publish order.created" in caplog.text

    def test_a_stalled_channel_layer_is_abandoned_after_the_timeout(self, monkeypatch, settings):
        settings.REALTIME = {**settings.REALTIME, "PUBLISH_TIMEOUT": 0.1}

        class StalledLayer:
            async def group_send(self, group, message):
                await asyncio.sleep(5)

        monkeypatch.setattr(publish, "get_channel_layer", StalledLayer)

        assert publish.publish_to_branch(1, {"type": "order.created"}) is False

    def test_publishing_pauses_briefly_after_a_failure(self, monkeypatch, settings):
        settings.REALTIME = {**settings.REALTIME, "FAILURE_COOLDOWN": 60}
        monkeypatch.setattr(publish, "_paused_until", 0.0)
        calls = []

        class BrokenLayer:
            async def group_send(self, group, message):
                calls.append(group)
                raise ConnectionError("redis is down")

        monkeypatch.setattr(publish, "get_channel_layer", BrokenLayer)

        assert publish.publish_to_branch(1, {"type": "order.created"}) is False
        assert publish.publish_to_branch(1, {"type": "order.updated"}) is False
        assert len(calls) == 1

    def test_errors_building_the_event_are_contained(
        self, client_for, staff_a, order_payload, monkeypatch, published
    ):
        def broken_build(*args, **kwargs):
            raise ValueError("bad data")

        monkeypatch.setattr(events, "build_event", broken_build)

        response = client_for(staff_a).post(URL, order_payload(), format="json")

        assert response.status_code == 201
        assert published == []
