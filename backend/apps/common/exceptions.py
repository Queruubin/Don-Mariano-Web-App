from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(Exception):
    """A business rule was violated. Rendered by the API as HTTP 400.

    `field` lets the client show the message inline next to the right input.
    `extra` adds machine-readable data to the response body.
    """

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(
        self,
        message: str,
        *,
        code: str = "invalid",
        field: str | None = None,
        extra: dict | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field
        self.extra = extra or {}


class ConflictError(DomainError):
    """The resource changed since the client last saw it. Rendered as HTTP 409."""

    status_code = status.HTTP_409_CONFLICT


def exception_handler(exc, context):
    if isinstance(exc, DomainError):
        body = {exc.field: [exc.message]} if exc.field else {"detail": exc.message}
        body["code"] = exc.code
        body.update(exc.extra)
        return Response(body, status=exc.status_code)
    return drf_exception_handler(exc, context)
