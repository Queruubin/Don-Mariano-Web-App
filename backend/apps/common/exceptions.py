from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(Exception):
    """A business rule was violated. Rendered by the API as HTTP 400.

    `field` lets the client show the message inline next to the right input.
    """

    def __init__(self, message: str, *, code: str = "invalid", field: str | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field


def exception_handler(exc, context):
    if isinstance(exc, DomainError):
        body = {exc.field: [exc.message]} if exc.field else {"detail": exc.message}
        body["code"] = exc.code
        return Response(body, status=status.HTTP_400_BAD_REQUEST)
    return drf_exception_handler(exc, context)
