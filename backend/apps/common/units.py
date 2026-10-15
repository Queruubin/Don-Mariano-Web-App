from django.db import models


class Unit(models.TextChoices):
    UNIDAD = "unidad", "Unidad"
    LIBRA = "libra", "Libra"
    KILO = "kilo", "Kilo"
    GRAMOS = "gramos", "Gramos"
    PAQUETE = "paquete", "Paquete"
    PESOS = "pesos", "Pesos ($)"
