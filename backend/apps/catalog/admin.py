from django.contrib import admin

from apps.catalog.models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "branch", "default_unit", "category", "is_active"]
    list_filter = ["branch", "is_active", "default_unit"]
    search_fields = ["name", "normalized_name"]
