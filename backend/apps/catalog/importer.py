"""Excel catalog import (PRD FR-10).

The import is stateless: the client uploads the same file twice, once to
preview and once to apply. Apply re-parses and re-classifies the file inside a
transaction, so nothing the client sends back is trusted.

Rows are upserted by `normalized_name` within the branch:

- `new`: no product with that name exists in the branch;
- `updated`: the product exists and the row changes it (including reactivating
  a deactivated product);
- `unchanged`: the product exists and already matches the row;
- `invalid`: the row cannot be imported; it carries Spanish reasons.

A blank unit or category never erases data: a new product gets the default
unit ("unidad") and no category; an existing product keeps its current values.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO

from django.db import IntegrityError, transaction
from django.utils import timezone
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from apps.branches.models import Branch
from apps.catalog.models import Product
from apps.common.exceptions import DomainError
from apps.common.text import normalize_text
from apps.common.units import Unit, parse_unit

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000
# How many leading rows may come before the header row (titles, notes...).
HEADER_SEARCH_ROWS = 10
MAX_COLUMNS = 30
MAX_BLANK_STREAK = 1000

NAME_MAX_LENGTH = Product._meta.get_field("name").max_length
CATEGORY_MAX_LENGTH = Product._meta.get_field("category").max_length

# Normalized header text -> field. Accents and case are ignored.
HEADER_ALIASES = {
    "nombre": "name",
    "producto": "name",
    "nombre del producto": "name",
    "unidad": "unit",
    "unidades": "unit",
    "unidad de medida": "unit",
    "categoria": "category",
    "categorias": "category",
}

FILE_FIELD = "file"


@dataclass
class ImportRow:
    row: int
    name: str
    unit: str
    category: str
    raw_unit: str = ""
    product: Product | None = None
    changes: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def reactivates(self) -> bool:
        return any(change["field"] == "is_active" for change in self.changes)

    def to_dict(self) -> dict:
        data = {
            "row": self.row,
            "name": self.name,
            "unit": self.unit or self.raw_unit,
            "category": self.category,
        }
        if self.product is not None:
            data["product_id"] = self.product.pk
        if self.changes:
            data["changes"] = self.changes
            data["reactivated"] = self.reactivates
        if self.errors:
            data["errors"] = self.errors
        return data


@dataclass
class ImportPreview:
    new: list[ImportRow] = field(default_factory=list)
    updated: list[ImportRow] = field(default_factory=list)
    unchanged: list[ImportRow] = field(default_factory=list)
    invalid: list[ImportRow] = field(default_factory=list)

    @property
    def valid_count(self) -> int:
        return len(self.new) + len(self.updated) + len(self.unchanged)

    def counts(self) -> dict:
        return {
            "new": len(self.new),
            "updated": len(self.updated),
            "unchanged": len(self.unchanged),
            "invalid": len(self.invalid),
            "total": self.valid_count + len(self.invalid),
        }

    def to_dict(self) -> dict:
        return {
            "counts": self.counts(),
            "new": [row.to_dict() for row in self.new],
            "updated": [row.to_dict() for row in self.updated],
            "unchanged": [row.to_dict() for row in self.unchanged],
            "invalid": [row.to_dict() for row in self.invalid],
        }


# --------------------------------------------------------------------------- template


def build_template() -> bytes:
    """The downloadable .xlsx template: a products sheet plus a units guide."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Productos"
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="308334")

    sheet.append(["nombre", "unidad", "categoria"])
    sheet.append(["Aguacate Hass", Unit.UNIDAD.value, "Frutas y verduras"])
    sheet.append(["Papa criolla", Unit.LIBRA.value, "Frutas y verduras"])
    for cell in sheet[1]:
        cell.font = header_font
        cell.fill = header_fill
    for column, width in (("A", 40), ("B", 16), ("C", 28)):
        sheet.column_dimensions[column].width = width
    sheet.freeze_panes = "A2"

    # A dropdown helps, but other spellings ("lb", "und") are still accepted.
    units_list = ",".join(Unit.values)
    validation = DataValidation(type="list", formula1=f'"{units_list}"', allow_blank=True)
    validation.showErrorMessage = False
    validation.add(f"B2:B{MAX_ROWS + 1}")
    sheet.add_data_validation(validation)

    guide = workbook.create_sheet("Unidades válidas")
    guide.append(["unidad", "Qué significa", "También se acepta"])
    examples = {
        Unit.UNIDAD: "und, unidades, u",
        Unit.LIBRA: "lb, libras",
        Unit.KILO: "kg, kilos",
        Unit.GRAMOS: "g, gr, gramo",
        Unit.PAQUETE: "paq, paquetes",
        Unit.PESOS: "$, peso",
    }
    for unit in Unit:
        guide.append([unit.value, unit.label, examples[unit]])
    for cell in guide[1]:
        cell.font = header_font
        cell.fill = header_fill
    guide.append([])
    guide.append(["Notas:"])
    guide.append(["- La columna nombre es obligatoria. Si la unidad está vacía se usa \"unidad\"."])
    guide.append(["- Si un producto ya existe en la sede (mismo nombre), se actualiza."])
    guide.append([f"- Máximo {MAX_ROWS} productos por archivo."])
    for column, width in (("A", 14), ("B", 22), ("C", 26)):
        guide.column_dimensions[column].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


# --------------------------------------------------------------------------- parsing


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return " ".join(str(value).split())


def _validate_upload(upload) -> None:
    if upload is None:
        raise DomainError("Seleccione un archivo de Excel (.xlsx).", field=FILE_FIELD, code="file_required")
    filename = (getattr(upload, "name", "") or "").lower()
    if filename.endswith(".xls") or filename.endswith(".csv"):
        raise DomainError(
            "Este archivo no es .xlsx. Ábralo en Excel y use \"Guardar como\" > \"Libro de Excel (.xlsx)\".",
            field=FILE_FIELD,
            code="file_type",
        )
    if not filename.endswith(".xlsx"):
        raise DomainError(
            "Solo se aceptan archivos de Excel (.xlsx).", field=FILE_FIELD, code="file_type"
        )
    if upload.size > MAX_FILE_BYTES:
        raise DomainError(
            "El archivo es muy grande. El máximo es 2 MB.", field=FILE_FIELD, code="file_too_large"
        )


def _find_header(rows) -> tuple[int, dict[str, int]]:
    """Return the 1-based header row number and a field -> column index map."""
    for row_number, values in enumerate(rows, start=1):
        columns: dict[str, int] = {}
        for index, value in enumerate(values):
            field_name = HEADER_ALIASES.get(normalize_text(_cell_text(value)))
            if field_name and field_name not in columns:
                columns[field_name] = index
        if "name" in columns:
            return row_number, columns
        if row_number >= HEADER_SEARCH_ROWS:
            break
    raise DomainError(
        "No encontramos la columna \"nombre\". Use la plantilla: columnas nombre, unidad y categoria.",
        field=FILE_FIELD,
        code="missing_header",
    )


def _unreadable() -> DomainError:
    return DomainError(
        "No pudimos abrir el archivo. Verifique que sea un Excel (.xlsx) y que no esté dañado.",
        field=FILE_FIELD,
        code="file_unreadable",
    )


def read_rows(upload) -> list[ImportRow]:
    """Parse the uploaded workbook into unclassified rows (no database access)."""
    _validate_upload(upload)
    upload.seek(0)
    try:
        workbook = load_workbook(BytesIO(upload.read()), read_only=True, data_only=True)
    except Exception:  # Untrusted input: any parser failure means "unreadable".
        raise _unreadable() from None

    try:
        parsed = _parse_sheet(workbook.worksheets[0])
    except DomainError:
        raise
    except Exception:  # read-only mode parses lazily, so errors can surface here too.
        raise _unreadable() from None
    finally:
        workbook.close()

    if not parsed:
        raise DomainError(
            "El archivo no tiene productos. Escriba uno por fila debajo de los títulos.",
            field=FILE_FIELD,
            code="empty_file",
        )
    return parsed


def _parse_sheet(sheet) -> list[ImportRow]:
    rows = sheet.iter_rows(max_col=MAX_COLUMNS, values_only=True)
    header_row, columns = _find_header(rows)

    def column(values, field_name):
        index = columns.get(field_name)
        if index is None or index >= len(values):
            return ""
        return _cell_text(values[index])

    parsed: list[ImportRow] = []
    blank_streak = 0
    # `rows` continues right after the header row.
    for row_number, values in enumerate(rows, start=header_row + 1):
        name, raw_unit, category = (
            column(values, "name"), column(values, "unit"), column(values, "category")
        )
        if not (name or raw_unit or category):
            blank_streak += 1
            # Read-only mode yields every row up to the last used one, even if it is
            # far below the data; a long blank stretch means the data has ended.
            if blank_streak >= MAX_BLANK_STREAK:
                break
            continue
        blank_streak = 0
        if len(parsed) >= MAX_ROWS:
            raise DomainError(
                f"El archivo tiene más de {MAX_ROWS} productos. Divídalo en varios archivos.",
                field=FILE_FIELD,
                code="too_many_rows",
            )
        parsed.append(ImportRow(row=row_number, name=name, unit="", category=category, raw_unit=raw_unit))
    return parsed


# --------------------------------------------------------------------------- classification


def _row_errors(row: ImportRow, seen: dict[str, int]) -> list[str]:
    errors = []
    if not row.name:
        errors.append("Falta el nombre del producto.")
    elif len(row.name) > NAME_MAX_LENGTH:
        errors.append(f"El nombre es muy largo (máximo {NAME_MAX_LENGTH} caracteres).")
    else:
        first_row = seen.get(normalize_text(row.name))
        if first_row is not None:
            errors.append(f"Este producto está repetido. Ya aparece en la fila {first_row}.")

    if row.raw_unit:
        row.unit = parse_unit(row.raw_unit) or ""
        if not row.unit:
            valid = ", ".join(Unit.values)
            errors.append(f"No reconocemos la unidad \"{row.raw_unit}\". Use: {valid}.")

    if len(row.category) > CATEGORY_MAX_LENGTH:
        errors.append(f"La categoría es muy larga (máximo {CATEGORY_MAX_LENGTH} caracteres).")
    return errors


def _changes(row: ImportRow, product: Product) -> list[dict]:
    changes = []

    def compare(field_name, old, new):
        if old != new:
            changes.append({"field": field_name, "from": old, "to": new})

    compare("name", product.name, row.name)
    compare("default_unit", product.default_unit, row.unit)
    compare("category", product.category, row.category)
    compare("is_active", product.is_active, True)
    return changes


def classify(branch: Branch, rows: list[ImportRow], *, lock: bool = False) -> ImportPreview:
    preview = ImportPreview()
    seen: dict[str, int] = {}
    valid: list[ImportRow] = []

    for row in rows:
        row.errors = _row_errors(row, seen)
        if row.errors:
            preview.invalid.append(row)
            continue
        seen[normalize_text(row.name)] = row.row
        valid.append(row)

    existing_qs = Product.objects.filter(branch=branch, normalized_name__in=list(seen))
    if lock:
        existing_qs = existing_qs.select_for_update()
    existing = {product.normalized_name: product for product in existing_qs}

    for row in valid:
        product = existing.get(normalize_text(row.name))
        if product is None:
            row.unit = row.unit or Unit.UNIDAD
            preview.new.append(row)
            continue
        row.product = product
        # Blank cells keep what the product already has.
        row.unit = row.unit or product.default_unit
        row.category = row.category or product.category
        row.changes = _changes(row, product)
        (preview.updated if row.changes else preview.unchanged).append(row)
    return preview


def preview_import(branch: Branch, upload) -> ImportPreview:
    return classify(branch, read_rows(upload))


def apply_import(branch: Branch, upload) -> dict:
    """Re-validate the file and upsert its valid rows in one transaction."""
    rows = read_rows(upload)
    try:
        with transaction.atomic():
            preview = classify(branch, rows, lock=True)
            if preview.valid_count == 0:
                raise DomainError(
                    "El archivo no tiene filas válidas para importar. "
                    "Corrija los errores e intente de nuevo.",
                    field=FILE_FIELD,
                    code="no_valid_rows",
                )
            Product.objects.bulk_create(
                [
                    Product(
                        branch=branch,
                        name=row.name,
                        normalized_name=normalize_text(row.name),
                        default_unit=row.unit,
                        category=row.category,
                    )
                    for row in preview.new
                ],
                batch_size=500,
            )
            now = timezone.now()
            to_update = []
            for row in preview.updated:
                product = row.product
                product.name = row.name
                product.default_unit = row.unit
                product.category = row.category
                product.is_active = True
                product.updated_at = now
                to_update.append(product)
            Product.objects.bulk_update(
                to_update,
                ["name", "default_unit", "category", "is_active", "updated_at"],
                batch_size=500,
            )
    except IntegrityError:
        raise DomainError(
            "Alguien más cambió el catálogo al mismo tiempo. Intente de nuevo.",
            field=FILE_FIELD,
            code="conflict",
        ) from None

    return {
        "counts": {
            "created": len(preview.new),
            "updated": len(preview.updated),
            "reactivated": sum(1 for row in preview.updated if row.reactivates),
            "unchanged": len(preview.unchanged),
            "invalid": len(preview.invalid),
        },
        "invalid": [row.to_dict() for row in preview.invalid],
    }
