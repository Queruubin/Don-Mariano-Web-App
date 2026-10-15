from django.utils import timezone

from apps.branches.models import Branch
from apps.common.text import normalize_phone
from apps.customers.models import Customer, CustomerAddress


def upsert_customer(*, branch: Branch, phone: str, name: str) -> Customer:
    """Create the branch customer for this phone, or refresh its name (FR-15)."""
    customer, created = Customer.objects.get_or_create(
        branch=branch, phone=normalize_phone(phone), defaults={"name": name}
    )
    if not created and customer.name != name:
        customer.name = name
        customer.save(update_fields=["name", "updated_at"])
    return customer


def upsert_address(*, customer: Customer, address: str, notes: str = "") -> CustomerAddress:
    """Reuse a saved address (case-insensitive match) or add a new one (FR-14)."""
    address = " ".join(address.split())
    saved = customer.addresses.filter(address__iexact=address).first()
    if saved is None:
        return CustomerAddress.objects.create(customer=customer, address=address, notes=notes)
    saved.notes = notes
    saved.last_used_at = timezone.now()
    saved.save(update_fields=["notes", "last_used_at"])
    return saved
