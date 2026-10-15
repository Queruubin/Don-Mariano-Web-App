import pytest

from apps.common.text import normalize_phone, normalize_text


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Aguacáte", "aguacate"),
        ("  PAPA   Criolla ", "papa criolla"),
        ("Ñame", "name"),
        ("Limón\tTahití", "limon tahiti"),
        ("", ""),
    ],
)
def test_normalize_text(raw, expected):
    assert normalize_text(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["3001234567", "300 123-4567", "+57 300-123 4567", "57 3001234567", "0057 300 123 4567"],
)
def test_normalize_phone_keeps_local_digits(raw):
    assert normalize_phone(raw) == "3001234567"


def test_normalize_phone_keeps_short_numbers_untouched():
    # Landline without area code, or a number that only starts with 57.
    assert normalize_phone("571 2345") == "5712345"
