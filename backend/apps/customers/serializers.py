from rest_framework import serializers

from apps.customers.models import Customer, CustomerAddress


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = ["id", "address", "notes", "last_used_at"]


class CustomerSerializer(serializers.ModelSerializer):
    addresses = CustomerAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = ["id", "phone", "name", "addresses", "created_at", "updated_at"]
