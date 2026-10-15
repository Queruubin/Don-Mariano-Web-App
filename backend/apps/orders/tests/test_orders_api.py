from decimal import Decimal

import pytest

from apps.customers.models import Customer, CustomerAddress
from apps.orders.models import Order, OrderStatus

URL = "/api/orders/"


def detail(order):
    return f"{URL}{order.pk}/"


@pytest.mark.django_db
class TestOrderScoping:
    def test_list_only_shows_own_branch(self, client_for, staff_a, staff_b, make_order, branch_a, branch_b):
        own = make_order(branch_a, staff_a)
        make_order(branch_b, staff_b)
        response = client_for(staff_a).get(URL)
        assert [o["id"] for o in response.data["results"]] == [own.pk]

    def test_other_branch_order_is_404_for_every_action(
        self, client_for, staff_a, staff_b, make_order, branch_b
    ):
        foreign = make_order(branch_b, staff_b)
        client = client_for(staff_a)
        assert client.get(detail(foreign)).status_code == 404
        assert client.patch(detail(foreign), {"notes": "x"}, format="json").status_code == 404
        assert client.post(f"{detail(foreign)}transition/").status_code == 404
        assert client.post(f"{detail(foreign)}cancel/", {"reason": "x"}, format="json").status_code == 404
        foreign.refresh_from_db()
        assert foreign.status == OrderStatus.PENDING

    def test_super_admin_requires_branch_header(self, client_for, super_admin, order_payload):
        client = client_for(super_admin)
        assert client.get(URL).status_code == 400
        assert client.post(URL, order_payload(), format="json").status_code == 400

    def test_super_admin_creates_in_selected_branch(self, client_for, super_admin, branch_b, order_payload):
        response = client_for(super_admin, branch=branch_b).post(URL, order_payload(), format="json")
        assert response.status_code == 201
        assert Order.objects.get(pk=response.data["id"]).branch == branch_b

    def test_cannot_order_product_from_another_branch(self, client_for, staff_a, product_b, order_payload):
        response = client_for(staff_a).post(URL, order_payload(product=product_b), format="json")
        assert response.status_code == 400
        assert "items" in response.data
        assert Order.objects.count() == 0

    def test_status_filter(self, client_for, staff_a, make_order, branch_a):
        pending = make_order(branch_a, staff_a)
        cancelled = make_order(branch_a, staff_a)
        client = client_for(staff_a)
        client.post(f"{detail(cancelled)}cancel/", {"reason": "Cliente no responde"}, format="json")
        response = client.get(URL, {"status": "pending,preparing"})
        assert [o["id"] for o in response.data["results"]] == [pending.pk]


@pytest.mark.django_db
class TestCreateOrder:
    def test_creates_order_with_catalog_and_free_text_items(
        self, client_for, staff_a, product_a, order_payload
    ):
        response = client_for(staff_a).post(URL, order_payload(product=product_a), format="json")
        assert response.status_code == 201, response.data
        data = response.data
        assert data["number"] == 1
        assert data["status"] == "pending"
        assert data["change_due"] == "5000"

        catalog_item, free_item = data["items"]
        assert catalog_item["product"] == product_a.pk
        assert catalog_item["name"] == product_a.name
        assert catalog_item["unit"] == product_a.default_unit  # defaulted from product
        assert catalog_item["notes"] == "bien verde"
        assert catalog_item["is_free_text"] is False
        assert free_item["product"] is None
        assert free_item["name"] == "Cilantro"
        assert free_item["unit"] == "pesos"
        assert free_item["is_free_text"] is True

        assert [(e["from_status"], e["to_status"]) for e in data["status_events"]] == [("", "pending")]
        assert data["created_by"] == staff_a.pk

    def test_upserts_customer_and_addresses(self, client_for, staff_a, branch_a, order_payload):
        client = client_for(staff_a)
        client.post(URL, order_payload(), format="json")

        customer = Customer.objects.get(branch=branch_a)
        assert customer.phone == "3001234567"
        assert customer.name == "Gloria Pérez"
        assert customer.addresses.count() == 1

        # Same phone: name is refreshed, the known address is reused, a new one is added.
        second = order_payload()
        second["customer"] = {**second["customer"], "name": "Gloria P.", "address": "cra 7  #45-10"}
        assert client.post(URL, second, format="json").status_code == 201
        customer.refresh_from_db()
        assert customer.name == "Gloria P."
        assert customer.addresses.count() == 1
        third = order_payload()
        third["customer"] = {**third["customer"], "address": "Calle 80 #20-30"}
        assert client.post(URL, third, format="json").status_code == 201

        assert Customer.objects.filter(branch=branch_a).count() == 1
        customer.refresh_from_db()
        assert customer.name == "Gloria Pérez"
        assert CustomerAddress.objects.filter(customer=customer).count() == 2

    def test_requires_items(self, client_for, staff_a, order_payload):
        response = client_for(staff_a).post(URL, order_payload(items=[]), format="json")
        assert response.status_code == 400
        assert "items" in response.data

    def test_item_needs_product_or_name(self, client_for, staff_a, order_payload):
        payload = order_payload(items=[{"quantity": "1"}])
        assert client_for(staff_a).post(URL, payload, format="json").status_code == 400

    def test_quantity_must_be_positive(self, client_for, staff_a, order_payload):
        payload = order_payload(items=[{"name": "Pan", "quantity": "0"}])
        assert client_for(staff_a).post(URL, payload, format="json").status_code == 400

    def test_total_must_be_positive(self, client_for, staff_a, order_payload):
        payload = order_payload(total_amount="0", pays_with=None)
        response = client_for(staff_a).post(URL, payload, format="json")
        assert response.status_code == 400
        assert "total_amount" in response.data


@pytest.mark.django_db
class TestPaysWith:
    @pytest.mark.parametrize("method", ["card", "nequi", "daviplata"])
    def test_only_allowed_for_cash(self, client_for, staff_a, order_payload, method):
        response = client_for(staff_a).post(URL, order_payload(payment_method=method), format="json")
        assert response.status_code == 400
        assert "pays_with" in response.data

    def test_must_cover_total(self, client_for, staff_a, order_payload):
        response = client_for(staff_a).post(URL, order_payload(pays_with="40000"), format="json")
        assert response.status_code == 400
        assert "pays_with" in response.data

    def test_exact_amount_and_omitted_are_valid(self, client_for, staff_a, order_payload):
        client = client_for(staff_a)
        assert client.post(URL, order_payload(pays_with="45000"), format="json").status_code == 201
        assert client.post(URL, order_payload(pays_with=None), format="json").status_code == 201
        response = client.post(URL, order_payload(payment_method="nequi", pays_with=None), format="json")
        assert response.status_code == 201

    def test_switching_to_card_on_edit_drops_pays_with(self, client_for, staff_a, order_payload):
        client = client_for(staff_a)
        order_id = client.post(URL, order_payload(), format="json").data["id"]
        response = client.patch(f"{URL}{order_id}/", {"payment_method": "card"}, format="json")
        assert response.status_code == 200
        assert response.data["pays_with"] is None


@pytest.mark.django_db
class TestOrderNumbering:
    def test_numbers_are_sequential_per_branch(
        self, client_for, staff_a, staff_b, order_payload
    ):
        client_a, client_b = client_for(staff_a), client_for(staff_b)
        numbers_a = [client_a.post(URL, order_payload(), format="json").data["number"] for _ in range(3)]
        numbers_b = [client_b.post(URL, order_payload(), format="json").data["number"] for _ in range(2)]
        assert numbers_a == [1, 2, 3]
        assert numbers_b == [1, 2]

    def test_failed_create_does_not_consume_a_number(
        self, client_for, staff_a, order_payload, branch_a
    ):
        client = client_for(staff_a)
        client.post(URL, order_payload(pays_with="1"), format="json")  # invalid
        assert client.post(URL, order_payload(), format="json").data["number"] == 1


@pytest.mark.django_db
class TestStatusTransitions:
    @pytest.fixture
    def order(self, make_order, branch_a, staff_a):
        return make_order(branch_a, staff_a)

    def test_full_happy_path_records_history(self, client_for, staff_a, order):
        client = client_for(staff_a)
        statuses = [
            client.post(f"{detail(order)}transition/").data["status"] for _ in range(3)
        ]
        assert statuses == ["preparing", "on_the_way", "delivered"]
        events = client.get(detail(order)).data["status_events"]
        assert [(e["from_status"], e["to_status"]) for e in events] == [
            ("", "pending"),
            ("pending", "preparing"),
            ("preparing", "on_the_way"),
            ("on_the_way", "delivered"),
        ]
        assert all(e["changed_by"] == staff_a.pk for e in events)

    def test_explicit_target_must_be_next_step(self, client_for, staff_a, order):
        client = client_for(staff_a)
        response = client.post(f"{detail(order)}transition/", {"to_status": "delivered"}, format="json")
        assert response.status_code == 400
        assert "to_status" in response.data
        response = client.post(f"{detail(order)}transition/", {"to_status": "preparing"}, format="json")
        assert response.status_code == 200

    def test_cannot_advance_final_order(self, client_for, staff_a, order):
        client = client_for(staff_a)
        for _ in range(3):
            client.post(f"{detail(order)}transition/")
        assert client.post(f"{detail(order)}transition/").status_code == 400

    def test_cancel_requires_reason(self, client_for, staff_a, order):
        client = client_for(staff_a)
        assert client.post(f"{detail(order)}cancel/", {}, format="json").status_code == 400
        assert client.post(f"{detail(order)}cancel/", {"reason": "   "}, format="json").status_code == 400
        order.refresh_from_db()
        assert order.status == OrderStatus.PENDING

    @pytest.mark.parametrize("steps", [0, 1, 2])
    def test_cancel_from_any_non_final_status(self, client_for, staff_a, order, steps):
        client = client_for(staff_a)
        for _ in range(steps):
            client.post(f"{detail(order)}transition/")
        response = client.post(f"{detail(order)}cancel/", {"reason": "Cliente canceló"}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == "cancelled"
        assert response.data["cancel_reason"] == "Cliente canceló"
        assert response.data["status_events"][-1]["to_status"] == "cancelled"

    def test_cannot_cancel_or_advance_final_orders(self, client_for, staff_a, order):
        client = client_for(staff_a)
        client.post(f"{detail(order)}cancel/", {"reason": "x"}, format="json")
        assert client.post(f"{detail(order)}cancel/", {"reason": "y"}, format="json").status_code == 400
        assert client.post(f"{detail(order)}transition/").status_code == 400


@pytest.mark.django_db
class TestEditRules:
    @pytest.fixture
    def order(self, make_order, branch_a, staff_a):
        return make_order(branch_a, staff_a)

    @pytest.mark.parametrize("steps", [0, 1])
    def test_editable_while_pending_or_preparing(self, client_for, staff_a, order, steps):
        client = client_for(staff_a)
        for _ in range(steps):
            client.post(f"{detail(order)}transition/")
        response = client.patch(
            detail(order),
            {
                "total_amount": "20000",
                "notes": "Tocar timbre",
                "items": [{"name": "Leche", "quantity": "2", "unit": "unidad"}],
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        assert response.data["total_amount"] == "20000"
        assert [i["name"] for i in response.data["items"]] == ["Leche"]

    @pytest.mark.parametrize("steps", [2, 3])
    def test_locked_after_preparing(self, client_for, staff_a, order, steps):
        client = client_for(staff_a)
        for _ in range(steps):
            client.post(f"{detail(order)}transition/")
        response = client.patch(detail(order), {"notes": "tarde"}, format="json")
        assert response.status_code == 400
        assert response.data["code"] == "order_not_editable"

    def test_locked_when_cancelled(self, client_for, staff_a, order):
        client = client_for(staff_a)
        client.post(f"{detail(order)}cancel/", {"reason": "x"}, format="json")
        assert client.patch(detail(order), {"notes": "x"}, format="json").status_code == 400

    def test_partial_update_keeps_other_fields(self, client_for, staff_a, order):
        response = client_for(staff_a).patch(detail(order), {"notes": "nuevo"}, format="json")
        assert response.status_code == 200
        order.refresh_from_db()
        assert order.total_amount == Decimal("10000")
        assert order.payment_method == "card"
        assert order.items.count() == 1

    def test_status_cannot_be_changed_through_edit(self, client_for, staff_a, order):
        client_for(staff_a).patch(detail(order), {"status": "delivered"}, format="json")
        order.refresh_from_db()
        assert order.status == OrderStatus.PENDING

    def test_orders_cannot_be_deleted(self, client_for, admin_a, order):
        assert client_for(admin_a).delete(detail(order)).status_code == 405
