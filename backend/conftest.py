from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.branches.models import Branch
from apps.catalog.models import Product
from apps.common.units import Unit
from apps.orders import services
from apps.users.models import User

PASSWORD = "Sup3r-Secret-Pass"


@pytest.fixture
def branch_a(db):
    return Branch.objects.create(name="Sede A", address="Calle 1 #2-3", phone="3000000001")


@pytest.fixture
def branch_b(db):
    return Branch.objects.create(name="Sede B", address="Calle 4 #5-6", phone="3000000002")


@pytest.fixture
def make_user(db):
    def _make(email, role, branch=None, **extra):
        return User.objects.create_user(
            email=email, password=PASSWORD, name=email.split("@")[0], role=role, branch=branch, **extra
        )

    return _make


@pytest.fixture
def super_admin(make_user):
    return make_user("root@test.co", User.Role.SUPER_ADMIN)


@pytest.fixture
def admin_a(make_user, branch_a):
    return make_user("admin.a@test.co", User.Role.BRANCH_ADMIN, branch_a)


@pytest.fixture
def staff_a(make_user, branch_a):
    return make_user("staff.a@test.co", User.Role.BRANCH_STAFF, branch_a)


@pytest.fixture
def admin_b(make_user, branch_b):
    return make_user("admin.b@test.co", User.Role.BRANCH_ADMIN, branch_b)


@pytest.fixture
def staff_b(make_user, branch_b):
    return make_user("staff.b@test.co", User.Role.BRANCH_STAFF, branch_b)


@pytest.fixture
def client_for():
    """Return an API client authenticated as `user`, optionally acting in `branch`."""

    def _client(user, branch=None):
        client = APIClient()
        client.force_authenticate(user=user)
        if branch is not None:
            client.credentials(HTTP_X_BRANCH_ID=str(branch.pk))
        return client

    return _client


@pytest.fixture
def product_a(branch_a):
    return Product.objects.create(branch=branch_a, name="Aguacáte Hass", default_unit=Unit.UNIDAD)


@pytest.fixture
def product_b(branch_b):
    return Product.objects.create(branch=branch_b, name="Papaya", default_unit=Unit.UNIDAD)


@pytest.fixture
def order_payload():
    def _payload(product=None, **overrides):
        items = [{"name": "Cilantro", "quantity": "1", "unit": Unit.PESOS, "notes": "$2.000"}]
        if product is not None:
            items.insert(0, {"product": product.pk, "quantity": "1.5", "notes": "bien verde"})
        payload = {
            "customer": {
                "phone": "300 123 4567",
                "name": "Gloria Pérez",
                "address": "Cra 7 #45-10",
                "address_notes": "apto 302",
            },
            "items": items,
            "payment_method": "cash",
            "total_amount": "45000",
            "pays_with": "50000",
            "notes": "",
        }
        payload.update(overrides)
        return payload

    return _payload


@pytest.fixture
def make_order(db):
    """Create an order directly through the domain service."""

    def _make(branch, user, phone="3001234567", total=Decimal("10000")):
        data = services.OrderData(
            customer=services.CustomerData(phone=phone, name="Cliente", address="Calle 1"),
            items=[services.ItemData(name="Pan", quantity=Decimal("1"), unit=Unit.UNIDAD)],
            payment_method="card",
            total_amount=total,
        )
        return services.create_order(branch=branch, user=user, data=data)

    return _make
