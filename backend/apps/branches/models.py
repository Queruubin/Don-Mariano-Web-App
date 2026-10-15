from django.db import models


class Branch(models.Model):
    name = models.CharField(max_length=200, unique=True)
    address = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    # Last order number issued in this branch. Incremented under a row lock
    # (see apps.orders.services.next_order_number).
    last_order_number = models.PositiveIntegerField(default=0, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "branches"
        ordering = ["name"]
        verbose_name = "Sede"
        verbose_name_plural = "Sedes"

    def __str__(self):
        return self.name
