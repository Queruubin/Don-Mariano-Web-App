import pytest

from apps.catalog.models import Product

URL = "/api/products/"
AUTOCOMPLETE_URL = "/api/products/autocomplete/"
CATEGORIES_URL = "/api/products/categories/"


def names(data):
    return [p["name"] for p in data]


@pytest.fixture
def catalog(branch_a, branch_b):
    products = [
        ("Papaya", "Frutas"),
        ("Papa criolla", "Verduras"),
        ("Pechuga de pollo", "Carnes"),
        ("Aguacáte Hass", "Frutas"),
        ("Pan tajado", "Panadería"),
        ("Tomate chonto", "verduras"),
        ("Arepa de papa", "Panadería"),
    ]
    for name, category in products:
        Product.objects.create(branch=branch_a, name=name, category=category)
    Product.objects.create(branch=branch_a, name="Papa pastusa", is_active=False)
    Product.objects.create(branch=branch_b, name="Papaya de otra sede", category="Otra")


@pytest.mark.django_db
class TestAutocomplete:
    def get(self, client, **params):
        response = client.get(AUTOCOMPLETE_URL, params)
        assert response.status_code == 200
        return names(response.data)

    def test_ranks_prefix_then_word_prefix_then_substring(self, client_for, staff_a, catalog):
        # Name prefix first (whole-word match before longer word), then a later
        # word starting with the term; inactive and other-branch products never show.
        assert self.get(client_for(staff_a), q="papa") == ["Papa criolla", "Papaya", "Arepa de papa"]

    def test_word_prefix_match(self, client_for, staff_a, catalog):
        assert self.get(client_for(staff_a), q="pollo") == ["Pechuga de pollo"]

    def test_substring_match(self, client_for, staff_a, catalog):
        assert self.get(client_for(staff_a), q="hon") == ["Tomate chonto"]

    def test_typo_tolerance(self, client_for, staff_a, catalog):
        assert self.get(client_for(staff_a), q="papya")[0] == "Papaya"
        assert self.get(client_for(staff_a), q="aguacte") == ["Aguacáte Hass"]

    def test_accent_and_case_insensitive(self, client_for, staff_a, catalog):
        assert self.get(client_for(staff_a), q="AGUACATE") == ["Aguacáte Hass"]
        assert self.get(client_for(staff_a), q="aguacáte") == ["Aguacáte Hass"]

    def test_limit(self, client_for, staff_a, catalog):
        assert len(self.get(client_for(staff_a), q="pa", limit=2)) == 2
        assert len(self.get(client_for(staff_a), q="pa", limit="abc")) <= 10

    def test_default_limit_is_ten(self, client_for, staff_a, branch_a):
        for i in range(15):
            Product.objects.create(branch=branch_a, name=f"Galleta {i:02d}")
        assert len(self.get(client_for(staff_a), q="galleta")) == 10

    def test_empty_query_returns_nothing(self, client_for, staff_a, catalog):
        assert self.get(client_for(staff_a), q="  ") == []

    def test_super_admin_needs_branch(self, client_for, super_admin, branch_b, catalog):
        assert client_for(super_admin).get(AUTOCOMPLETE_URL, {"q": "papa"}).status_code == 400
        assert self.get(client_for(super_admin, branch=branch_b), q="papa") == ["Papaya de otra sede"]


@pytest.mark.django_db
class TestListFilters:
    def test_search_on_list_is_ranked_and_paginated(self, client_for, staff_a, catalog):
        response = client_for(staff_a).get(URL, {"search": "papa"})
        assert response.data["count"] == 3
        assert names(response.data["results"]) == ["Papa criolla", "Papaya", "Arepa de papa"]

    def test_is_active_filter(self, client_for, admin_a, catalog):
        client = client_for(admin_a)
        assert names(client.get(URL, {"is_active": "false"}).data["results"]) == ["Papa pastusa"]
        assert client.get(URL, {"is_active": "true"}).data["count"] == 7
        assert client.get(URL).data["count"] == 7
        assert client.get(URL, {"include_inactive": "true"}).data["count"] == 8

    def test_category_filter_is_case_insensitive(self, client_for, staff_a, catalog):
        response = client_for(staff_a).get(URL, {"category": "VERDURAS"})
        assert names(response.data["results"]) == ["Papa criolla", "Tomate chonto"]

    def test_combined_filters(self, client_for, staff_a, catalog):
        response = client_for(staff_a).get(URL, {"category": "Frutas", "search": "pap"})
        assert names(response.data["results"]) == ["Papaya"]


@pytest.mark.django_db
class TestCategories:
    def test_distinct_sorted_branch_categories(self, client_for, staff_a, catalog):
        response = client_for(staff_a).get(CATEGORIES_URL)
        assert response.status_code == 200
        # "Verduras" and "verduras" are merged; the other branch's category is absent.
        assert len(response.data) == 4
        assert [c.lower() for c in response.data] == ["carnes", "frutas", "panadería", "verduras"]


@pytest.mark.django_db
class TestActivate:
    def test_admin_reactivates(self, client_for, admin_a, branch_a):
        product = Product.objects.create(branch=branch_a, name="Mango", is_active=False)
        response = client_for(admin_a).post(f"{URL}{product.pk}/activate/")
        assert response.status_code == 200
        assert response.data["is_active"] is True

    def test_staff_cannot_reactivate(self, client_for, staff_a, branch_a):
        product = Product.objects.create(branch=branch_a, name="Mango", is_active=False)
        assert client_for(staff_a).post(f"{URL}{product.pk}/activate/").status_code == 403

    def test_other_branch_is_404(self, client_for, admin_a, branch_b):
        product = Product.objects.create(branch=branch_b, name="Mango", is_active=False)
        assert client_for(admin_a).post(f"{URL}{product.pk}/activate/").status_code == 404
