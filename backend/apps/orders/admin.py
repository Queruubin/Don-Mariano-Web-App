from django.contrib import admin

from apps.orders.models import Order, OrderItem, OrderStatusEvent


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class OrderStatusEventInline(admin.TabularInline):
    model = OrderStatusEvent
    extra = 0
    readonly_fields = ["from_status", "to_status", "changed_by", "changed_at"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["number", "branch", "customer", "status", "payment_method", "total_amount", "created_at"]
    list_filter = ["branch", "status", "payment_method"]
    search_fields = ["customer__name", "customer__phone"]
    readonly_fields = ["number"]
    inlines = [OrderItemInline, OrderStatusEventInline]
