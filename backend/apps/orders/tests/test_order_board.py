"""Order board queries and lifecycle concurrency (PRD FR-27, FR-28, FR-31)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.orders.models import Order, OrderStatus

URL = "/api/orders/"


def detail(order):
    return f"{URL}{order.pk}/"


def ids(response):
    return [o["id"] for o in response.data["results"]]


@pytest.fixture
def order(make_order, branch_a, staff_a):
    return make_order(branch_a, staff_a)


@pytest.mark.django_db
class TestBoardList:
    def test_board_shows_active_and_todays_finished_orders(self, client_for, staff_a, make_order, branch_a):
        client = client_for(staff_a)
        pending = make_order(branch_a, staff_a)
        preparing = make_order(branch_a, staff_a)
        client.post(f"{detail(preparing)}transition/")
        delivered_today = make_order(branch_a, staff_a)
        for _ in range(3):
            client.post(f"{detail(delivered_today)}transition/")
        cancelled_today = make_order(branch_a, staff_a)
        client.post(f"{detail(cancelled_today)}cancel/", {"reason": "Cliente canceló"}, format="json")
        delivered_yesterday = make_order(branch_a, staff_a)
        Order.objects.filter(pk=delivered_yesterday.pk).update(
            status=OrderStatus.DELIVERED, status_changed_at=timezone.now() - timedelta(days=1)
        )

        response = client.get(URL, {"board": "true"})

        assert response.status_code == 200
        # Newest first.
        assert ids(response) == [cancelled_today.pk, delivered_today.pk, preparing.pk, pending.pk]

    def test_board_for_another_date(self, client_for, staff_a, order):
        Order.objects.filter(pk=order.pk).update(
            status=OrderStatus.DELIVERED, status_changed_at=timezone.now() - timedelta(days=1)
        )
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        response = client_for(staff_a).get(URL, {"board": "true", "date": yesterday})
        assert ids(response) == [order.pk]

    def test_active_filter_excludes_final_orders(self, client_for, staff_a, make_order, branch_a):
        client = client_for(staff_a)
        active = make_order(branch_a, staff_a)
        cancelled = make_order(branch_a, staff_a)
        client.post(f"{detail(cancelled)}cancel/", {"reason": "x"}, format="json")
        assert ids(client.get(URL, {"active": "true"})) == [active.pk]

    def test_date_filters_by_creation_day(self, client_for, staff_a, make_order, branch_a):
        today = make_order(branch_a, staff_a)
        old = make_order(branch_a, staff_a)
        Order.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=3))
        response = client_for(staff_a).get(URL, {"date": timezone.localdate().isoformat()})
        assert ids(response) == [today.pk]

    def test_invalid_date_is_a_friendly_400(self, client_for, staff_a):
        response = client_for(staff_a).get(URL, {"board": "true", "date": "ayer"})
        assert response.status_code == 400
        assert "date" in response.data

    def test_card_fields(self, client_for, staff_a, order):
        card = client_for(staff_a).get(URL, {"board": "true"}).data["results"][0]
        assert card["item_count"] == 1
        assert card["customer"]["name"] == "Cliente"
        assert card["customer"]["phone"] == "3001234567"
        assert card["created_by_name"] == staff_a.name
        assert card["status_changed_at"]
        assert card["next_status"] == "preparing"
        assert "items" not in card
        assert "status_events" not in card

    def test_board_page_size_can_be_raised(self, client_for, staff_a, make_order, branch_a):
        for _ in range(25):
            make_order(branch_a, staff_a)
        client = client_for(staff_a)
        assert len(client.get(URL).data["results"]) == 20
        assert len(client.get(URL, {"board": "true", "page_size": 200}).data["results"]) == 25

    def test_list_query_count_does_not_grow_with_orders(self, client_for, staff_a, make_order, branch_a):
        client = client_for(staff_a)
        make_order(branch_a, staff_a)
        with CaptureQueriesContext(connection) as one:
            client.get(URL, {"board": "true"})
        for index in range(10):
            make_order(branch_a, staff_a, phone=f"30012345{index:02d}")
        with CaptureQueriesContext(connection) as many:
            response = client.get(URL, {"board": "true"})
        assert len(response.data["results"]) == 11
        assert len(many) == len(one)
        assert len(many) <= 4

    def test_board_is_scoped_to_branch(self, client_for, staff_a, staff_b, make_order, branch_a, branch_b):
        own = make_order(branch_a, staff_a)
        make_order(branch_b, staff_b)
        assert ids(client_for(staff_a).get(URL, {"board": "true"})) == [own.pk]


@pytest.mark.django_db
class TestSince:
    def test_returns_only_orders_changed_after(self, client_for, staff_a, make_order, branch_a):
        client = client_for(staff_a)
        untouched = make_order(branch_a, staff_a)
        moved = make_order(branch_a, staff_a)
        since = timezone.now()
        Order.objects.filter(pk__in=[untouched.pk, moved.pk]).update(
            updated_at=since - timedelta(seconds=5)
        )
        client.post(f"{detail(moved)}transition/")
        created = make_order(branch_a, staff_a)

        response = client.get(URL, {"since": since.isoformat()})

        assert response.status_code == 200
        assert ids(response) == [created.pk, moved.pk]

    def test_unencoded_plus_offset_is_accepted(self, client_for, staff_a, order):
        response = client_for(staff_a).get(f"{URL}?since=2000-01-01T00:00:00+05:00")
        assert response.status_code == 200
        assert ids(response) == [order.pk]

    def test_invalid_since_is_400(self, client_for, staff_a):
        response = client_for(staff_a).get(URL, {"since": "hace rato"})
        assert response.status_code == 400
        assert "since" in response.data


@pytest.mark.django_db
class TestTransitionEndpoint:
    def test_next_keyword_and_returns_updated_order(self, client_for, staff_a, order):
        response = client_for(staff_a).post(
            f"{detail(order)}transition/",
            {"to_status": "next", "expected_status": "pending"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "preparing"
        assert response.data["next_status"] == "on_the_way"
        assert [i["name"] for i in response.data["items"]] == ["Pan"]

    def test_transition_updates_status_changed_at(self, client_for, staff_a, order):
        before = order.status_changed_at
        client_for(staff_a).post(f"{detail(order)}transition/")
        order.refresh_from_db()
        assert order.status_changed_at > before

    def test_stale_expected_status_is_409(self, client_for, staff_a, order):
        client = client_for(staff_a)
        client.post(f"{detail(order)}transition/", {"expected_status": "pending"}, format="json")
        # A second tablet still shows the order as pending.
        response = client.post(
            f"{detail(order)}transition/", {"expected_status": "pending"}, format="json"
        )
        assert response.status_code == 409
        assert response.data["detail"].startswith("Este domicilio ya cambió de estado")
        assert response.data["code"] == "stale_status"
        assert response.data["status"] == "preparing"
        order.refresh_from_db()
        assert order.status == OrderStatus.PREPARING

    def test_stale_cancel_is_409(self, client_for, staff_a, order):
        client = client_for(staff_a)
        client.post(f"{detail(order)}transition/")
        response = client.post(
            f"{detail(order)}cancel/",
            {"reason": "Cliente canceló", "expected_status": "pending"},
            format="json",
        )
        assert response.status_code == 409
        order.refresh_from_db()
        assert order.status == OrderStatus.PREPARING

    @pytest.mark.parametrize("target", ["delivered", "cancelled", "pending"])
    def test_invalid_targets_are_rejected(self, client_for, staff_a, order, target):
        response = client_for(staff_a).post(
            f"{detail(order)}transition/", {"to_status": target}, format="json"
        )
        assert response.status_code == 400
        assert "to_status" in response.data
        order.refresh_from_db()
        assert order.status == OrderStatus.PENDING

    def test_unknown_target_is_rejected(self, client_for, staff_a, order):
        response = client_for(staff_a).post(
            f"{detail(order)}transition/", {"to_status": "volando"}, format="json"
        )
        assert response.status_code == 400

    def test_cancel_reason_required_and_recorded_in_history(self, client_for, staff_a, order):
        client = client_for(staff_a)
        response = client.post(f"{detail(order)}cancel/", {"reason": ""}, format="json")
        assert response.status_code == 400
        assert "reason" in response.data
        response = client.post(
            f"{detail(order)}cancel/",
            {"reason": "No hay producto", "expected_status": "pending"},
            format="json",
        )
        assert response.status_code == 200
        last = response.data["status_events"][-1]
        assert last["to_status"] == "cancelled"
        assert last["reason"] == "No hay producto"
        assert last["changed_by_name"] == staff_a.name

    def test_cross_branch_transition_is_404(self, client_for, staff_b, order):
        response = client_for(staff_b).post(
            f"{detail(order)}transition/", {"expected_status": "pending"}, format="json"
        )
        assert response.status_code == 404
        order.refresh_from_db()
        assert order.status == OrderStatus.PENDING

    @pytest.mark.parametrize("user_fixture", ["staff_a", "admin_a"])
    def test_branch_members_can_move_orders(self, request, client_for, order, user_fixture):
        user = request.getfixturevalue(user_fixture)
        response = client_for(user).post(f"{detail(order)}transition/")
        assert response.status_code == 200
        assert response.data["status_events"][-1]["changed_by"] == user.pk

    def test_super_admin_moves_orders_in_selected_branch(
        self, client_for, super_admin, branch_a, branch_b, order
    ):
        assert client_for(super_admin, branch=branch_b).post(f"{detail(order)}transition/").status_code == 404
        assert client_for(super_admin, branch=branch_a).post(f"{detail(order)}transition/").status_code == 200


@pytest.mark.django_db
class TestOrderDetail:
    def test_detail_has_items_and_history_with_names(self, client_for, staff_a, admin_a, order):
        client_for(admin_a).post(f"{detail(order)}transition/")
        data = client_for(staff_a).get(detail(order)).data
        assert data["items"][0]["is_free_text"] is True
        events = data["status_events"]
        assert [(e["from_status"], e["to_status"]) for e in events] == [
            ("", "pending"),
            ("pending", "preparing"),
        ]
        assert [e["changed_by_name"] for e in events] == [staff_a.name, admin_a.name]
        assert all(e["changed_at"] for e in events)
        assert all(e["reason"] == "" for e in events)
