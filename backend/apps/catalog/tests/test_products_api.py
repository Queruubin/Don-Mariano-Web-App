import pytest

from apps.catalog.models import Product

URL = "/api/products/"


def names(response):
    return [p["name"] for p in response.data["results"]]


@pytest.mark.django_db
class TestProductScoping:
    def test_list_only_shows_own_branch(self, client_for, staff_a, product_a, product_b):
        response = client_for(staff_a).get(URL)
        assert response.status_code == 200
        assert names(response) == [product_a.name]

    def test_other_branch_detail_is_404(self, client_for, staff_a, admin_a, product_b):
        assert client_for(staff_a).get(f"{URL}{product_b.pk}/").status_code == 404
        response = client_for(admin_a).patch(f"{URL}{product_b.pk}/", {"name": "x"}, format="json")
        assert response.status_code == 404
        assert client_for(admin_a).delete(f"{URL}{product_b.pk}/").status_code == 404

    def test_branch_header_is_ignored_for_branch_users(
        self, client_for, staff_a, branch_b, product_a, product_b
    ):
        response = client_for(staff_a, branch=branch_b).get(URL)
        assert names(response) == [product_a.name]

    def test_super_admin_requires_branch_header(self, client_for, super_admin, product_a):
        response = client_for(super_admin).get(URL)
        assert response.status_code == 400
        assert "branch" in response.data

    def test_super_admin_rejects_unknown_or_inactive_branch(self, client_for, super_admin, branch_b):
        client = client_for(super_admin)
        assert client.get(URL, HTTP_X_BRANCH_ID="999999").status_code == 400
        assert client.get(URL, HTTP_X_BRANCH_ID="abc").status_code == 400
        branch_b.is_active = False
        branch_b.save()
        assert client_for(super_admin, branch=branch_b).get(URL).status_code == 400

    def test_super_admin_acts_in_selected_branch(
        self, client_for, super_admin, branch_b, product_a, product_b
    ):
        response = client_for(super_admin, branch=branch_b).get(URL)
        assert names(response) == [product_b.name]
        assert client_for(super_admin, branch=branch_b).get(f"{URL}{product_a.pk}/").status_code == 404

    def test_super_admin_branch_query_param(self, client_for, super_admin, branch_a, product_a):
        response = client_for(super_admin).get(URL, {"branch": branch_a.pk})
        assert names(response) == [product_a.name]


@pytest.mark.django_db
class TestProductWrites:
    payload = {"name": "Tomate chonto", "default_unit": "libra", "category": "Verduras"}

    def test_staff_cannot_write(self, client_for, staff_a, product_a):
        client = client_for(staff_a)
        assert client.post(URL, self.payload, format="json").status_code == 403
        assert client.delete(f"{URL}{product_a.pk}/").status_code == 403

    def test_admin_creates_product_in_own_branch(self, client_for, admin_a, branch_a):
        response = client_for(admin_a).post(URL, self.payload, format="json")
        assert response.status_code == 201
        product = Product.objects.get(pk=response.data["id"])
        assert product.branch == branch_a
        assert product.normalized_name == "tomate chonto"

    def test_super_admin_creates_in_selected_branch(self, client_for, super_admin, branch_b):
        response = client_for(super_admin, branch=branch_b).post(URL, self.payload, format="json")
        assert response.status_code == 201
        assert Product.objects.get(pk=response.data["id"]).branch == branch_b

    def test_duplicate_normalized_name_rejected_within_branch(self, client_for, admin_a, product_a):
        response = client_for(admin_a).post(URL, {"name": "  AGUACATE  hass"}, format="json")
        assert response.status_code == 400
        assert "name" in response.data

    def test_same_name_allowed_in_another_branch(self, client_for, admin_b, product_a):
        response = client_for(admin_b).post(URL, {"name": "Aguacate Hass"}, format="json")
        assert response.status_code == 201

    def test_delete_deactivates(self, client_for, admin_a, product_a):
        client = client_for(admin_a)
        assert client.delete(f"{URL}{product_a.pk}/").status_code == 204
        product_a.refresh_from_db()
        assert product_a.is_active is False
        assert names(client.get(URL)) == []
        assert names(client.get(URL, {"include_inactive": "true"})) == [product_a.name]


@pytest.mark.django_db
class TestProductSearch:
    @pytest.fixture
    def catalog(self, branch_a, branch_b):
        for name in ["Aguacáte", "Papaya", "Papa criolla", "Tomate"]:
            Product.objects.create(branch=branch_a, name=name)
        Product.objects.create(branch=branch_b, name="Aguacate de otra sede")

    @pytest.mark.parametrize(
        ("term", "expected"),
        [
            ("aguacate", ["Aguacáte"]),
            ("AGUACÁTE", ["Aguacáte"]),
            ("papa", ["Papa criolla", "Papaya"]),
            ("criolla papa", ["Papa criolla"]),
            ("zzz", []),
        ],
    )
    def test_accent_and_case_insensitive_partial_search(
        self, client_for, staff_a, catalog, term, expected
    ):
        response = client_for(staff_a).get(URL, {"search": term})
        assert names(response) == expected
