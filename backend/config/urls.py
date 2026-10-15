from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.branches.views import BranchViewSet
from apps.catalog.views import ProductViewSet
from apps.customers.views import CustomerViewSet
from apps.orders.views import OrderViewSet
from apps.users.views import UserViewSet

router = DefaultRouter()
router.register("branches", BranchViewSet, basename="branch")
router.register("users", UserViewSet, basename="user")
router.register("products", ProductViewSet, basename="product")
router.register("customers", CustomerViewSet, basename="customer")
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include(router.urls)),
]
