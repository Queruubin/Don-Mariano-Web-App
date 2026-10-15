from django.core.management.base import BaseCommand
from django.db import transaction

from apps.branches.models import Branch
from apps.catalog.models import Product
from apps.common.text import normalize_text
from apps.common.units import Unit

PRODUCTS = [
    ("Aguacate Hass", Unit.UNIDAD, "Frutas y verduras"),
    ("Papaya", Unit.UNIDAD, "Frutas y verduras"),
    ("Papa criolla", Unit.LIBRA, "Frutas y verduras"),
    ("Papa pastusa", Unit.KILO, "Frutas y verduras"),
    ("Tomate chonto", Unit.LIBRA, "Frutas y verduras"),
    ("Cebolla cabezona", Unit.LIBRA, "Frutas y verduras"),
    ("Cilantro", Unit.PESOS, "Frutas y verduras"),
    ("Plátano maduro", Unit.UNIDAD, "Frutas y verduras"),
    ("Banano", Unit.LIBRA, "Frutas y verduras"),
    ("Limón Tahití", Unit.LIBRA, "Frutas y verduras"),
    ("Queso campesino", Unit.GRAMOS, "Lácteos"),
    ("Leche entera 1L", Unit.UNIDAD, "Lácteos"),
    ("Huevos AA x30", Unit.PAQUETE, "Huevos"),
    ("Arroz blanco 1kg", Unit.PAQUETE, "Granos"),
    ("Fríjol cargamanto", Unit.LIBRA, "Granos"),
    ("Lenteja", Unit.LIBRA, "Granos"),
    ("Azúcar 1kg", Unit.PAQUETE, "Despensa"),
    ("Aceite vegetal 1L", Unit.UNIDAD, "Despensa"),
    ("Café molido 500g", Unit.PAQUETE, "Despensa"),
    ("Pan tajado", Unit.PAQUETE, "Panadería"),
    ("Carne molida", Unit.LIBRA, "Carnes"),
    ("Pechuga de pollo", Unit.KILO, "Carnes"),
]


class Command(BaseCommand):
    help = "Create the development catalog in every branch (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        for branch in Branch.objects.all():
            existing = set(
                Product.objects.filter(branch=branch).values_list("normalized_name", flat=True)
            )
            created = 0
            for name, unit, category in PRODUCTS:
                if normalize_text(name) in existing:
                    continue
                Product.objects.create(
                    branch=branch, name=name, default_unit=unit, category=category
                )
                created += 1
            self.stdout.write(self.style.SUCCESS(f"[OK] {branch.name}: {created} product(s) created"))
