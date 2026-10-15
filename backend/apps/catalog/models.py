from django.contrib.postgres.indexes import GinIndex
from django.db import models

from apps.common.text import normalize_text
from apps.common.units import Unit


class Product(models.Model):
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=200)
    # Lowercase, accent-free, whitespace-collapsed name. Used for uniqueness,
    # the Excel upsert key and accent-insensitive search (FR-10, FR-12).
    normalized_name = models.CharField(max_length=200, editable=False)
    default_unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.UNIDAD)
    category = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "normalized_name"],
                name="product_unique_name_per_branch",
            ),
        ]
        indexes = [
            GinIndex(
                fields=["normalized_name"],
                opclasses=["gin_trgm_ops"],
                name="product_name_trgm",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = " ".join(self.name.split())
        self.normalized_name = normalize_text(self.name)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "name" in update_fields:
            kwargs["update_fields"] = {*update_fields, "normalized_name"}
        super().save(*args, **kwargs)
