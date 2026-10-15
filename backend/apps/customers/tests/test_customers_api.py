import pytest

URL = "/api/customers/"
LOOKUP_URL = f"{URL}lookup/"


@pytest.mark.django_db
class TestCustomerScoping:
    @pytest.fixture
    def orders(self, make_order, branch_a, branch_b, staff_a, staff_b):
        # The same phone exists in both branches as two separate customers.
        return make_order(branch_a, staff_a), make_order(branch_b, staff_b)

    def test_list_only_shows_own_branch(self, client_for, staff_a, orders):
        order_a, _ = orders
        response = client_for(staff_a).get(URL)
        assert [c["id"] for c in response.data["results"]] == [order_a.customer_id]

    def test_other_branch_detail_is_404(self, client_for, staff_a, orders):
        _, order_b = orders
        assert client_for(staff_a).get(f"{URL}{order_b.customer_id}/").status_code == 404

    def test_lookup_by_phone_returns_own_branch_customer_with_addresses(
        self, client_for, staff_a, orders
    ):
        order_a, _ = orders
        response = client_for(staff_a).get(LOOKUP_URL, {"phone": "300 123-4567"})
        assert response.status_code == 200
        assert response.data["id"] == order_a.customer_id
        assert [a["address"] for a in response.data["addresses"]] == ["Calle 1"]

    def test_lookup_does_not_leak_other_branch(self, client_for, staff_a, make_order, branch_b, staff_b):
        make_order(branch_b, staff_b, phone="3109998888")
        response = client_for(staff_a).get(LOOKUP_URL, {"phone": "3109998888"})
        assert response.status_code == 404

    def test_lookup_requires_phone(self, client_for, staff_a):
        assert client_for(staff_a).get(LOOKUP_URL).status_code == 400

    def test_super_admin_requires_branch(self, client_for, super_admin):
        assert client_for(super_admin).get(URL).status_code == 400

    def test_customers_are_read_only(self, client_for, admin_a):
        response = client_for(admin_a).post(URL, {"phone": "1", "name": "x"}, format="json")
        assert response.status_code == 405
