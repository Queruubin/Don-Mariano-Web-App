import re
import unicodedata

_WHITESPACE = re.compile(r"\s+")
_NON_DIGITS = re.compile(r"\D")


def normalize_text(value: str) -> str:
    """Lowercase, strip accents and collapse whitespace.

    Used for accent/case-insensitive matching ("Aguacáte" -> "aguacate").
    """
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return _WHITESPACE.sub(" ", without_accents).strip().lower()


def normalize_phone(value: str) -> str:
    """Keep digits only so "300 111-2233" and "3001112233" are the same customer."""
    return _NON_DIGITS.sub("", value or "")
