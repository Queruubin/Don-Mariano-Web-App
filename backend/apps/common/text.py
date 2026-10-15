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


# Colombian numbers have 10 digits; "+57" / "0057" is the country prefix.
_COUNTRY_PREFIXES = ("0057", "57")
_LOCAL_PHONE_LENGTH = 10


def normalize_phone(value: str) -> str:
    """Keep digits only and drop the Colombian country prefix.

    "300 111-2233", "+57 300 111 2233" and "3001112233" are the same customer.
    """
    digits = _NON_DIGITS.sub("", value or "")
    for prefix in _COUNTRY_PREFIXES:
        if digits.startswith(prefix) and len(digits) == len(prefix) + _LOCAL_PHONE_LENGTH:
            return digits[len(prefix):]
    return digits
