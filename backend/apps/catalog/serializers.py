from rest_framework import serializers

from apps.catalog.models import Product
from apps.common.text import normalize_text


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id", "name", "default_unit", "category",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("El nombre es obligatorio.")
        queryset = Product.objects.filter(
            branch=self.context["branch"], normalized_name=normalize_text(value)
        )
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un producto con este nombre en la sede.")
        return value

    def create(self, validated_data):
        return Product.objects.create(branch=self.context["branch"], **validated_data)
