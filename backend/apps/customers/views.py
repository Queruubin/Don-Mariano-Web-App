from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.permissions import IsBranchMember
from apps.common.scoping import BranchScopedMixin
from apps.common.text import normalize_phone
from apps.customers.models import Customer
from apps.customers.serializers import CustomerSerializer


class CustomerViewSet(BranchScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Customers are written only as a side effect of orders (FR-15)."""

    queryset = Customer.objects.prefetch_related("addresses")
    serializer_class = CustomerSerializer
    permission_classes = [IsBranchMember]

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        phone = normalize_phone(request.query_params.get("phone", ""))
        if not phone:
            raise ValidationError({"phone": ["Ingrese un número de teléfono."]})
        customer = get_object_or_404(self.get_queryset(), phone=phone)
        return Response(self.get_serializer(customer).data)
