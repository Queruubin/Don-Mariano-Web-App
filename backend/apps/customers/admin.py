from django.contrib import admin

from apps.customers.models import Customer, CustomerAddress


class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 0


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "branch", "updated_at"]
    list_filter = ["branch"]
    search_fields = ["name", "phone"]
    inlines = [CustomerAddressInline]
