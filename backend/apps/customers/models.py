from django.db import models
from django.utils import timezone


class Customer(models.Model):
    branch = models.ForeignKey(
        "branches.Branch", on_delete=models.PROTECT, related_name="customers"
    )
    # Digits only (see apps.common.text.normalize_phone). Lookup key (FR-13).
    phone = models.CharField(max_length=20)
    name = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customers"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "phone"], name="customer_unique_phone_per_branch"
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.phone})"


class CustomerAddress(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="addresses")
    address = models.CharField(max_length=255)
    notes = models.CharField(max_length=255, blank=True)
    last_used_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "customer_addresses"
        ordering = ["-last_used_at"]

    def __str__(self):
        return self.address
