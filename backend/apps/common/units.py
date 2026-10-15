import re

from django.db import models

from apps.common.text import normalize_text


class Unit(models.TextChoices):
    UNIDAD = "unidad", "Unidad"
    LIBRA = "libra", "Libra"
    KILO = "kilo", "Kilo"
    GRAMOS = "gramos", "Gramos"
    PAQUETE = "paquete", "Paquete"
    PESOS = "pesos", "Pesos ($)"


# Spellings people actually type in a spreadsheet, after `_unit_key` cleanup
# (lowercase, no accents, only letters and "$").
_UNIT_ALIASES: dict[str, str] = {
    **dict.fromkeys(
        ["unidad", "unidades", "und", "unds", "un", "u", "ud", "uds", "unid", "unids"], Unit.UNIDAD
    ),
    **dict.fromkeys(["libra", "libras", "lb", "lbs", "lib", "libs"], Unit.LIBRA),
    **dict.fromkeys(
        ["kilo", "kilos", "kg", "kgs", "k", "kilogramo", "kilogramos", "kl"], Unit.KILO
    ),
    **dict.fromkeys(["gramo", "gramos", "gr", "grs", "g", "grm", "grms"], Unit.GRAMOS),
    **dict.fromkeys(
        ["paquete", "paquetes", "paq", "paqs", "pqt", "pqte", "pq", "paca", "pacas"], Unit.PAQUETE
    ),
    **dict.fromkeys(["pesos", "peso", "$", "pesos$", "cop", "plata"], Unit.PESOS),
}

_NOT_UNIT_CHARS = re.compile(r"[^a-z$]")


def _unit_key(value: str) -> str:
    return _NOT_UNIT_CHARS.sub("", normalize_text(value))


def parse_unit(value) -> str | None:
    """Map a free-form unit ("Lbs.", "Unidades", "$") to a `Unit` value, or None."""
    key = _unit_key(str(value or ""))
    if not key:
        return None
    if key in _UNIT_ALIASES:
        return _UNIT_ALIASES[key]
    # Plural forms that are not listed explicitly ("grss" -> "grs").
    for suffix in ("es", "s"):
        if key.endswith(suffix) and key[: -len(suffix)] in _UNIT_ALIASES:
            return _UNIT_ALIASES[key[: -len(suffix)]]
    return None
