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


def test_normalize_phone_keeps_digits():
    assert normalize_phone("+57 300-123 4567") == "573001234567"
