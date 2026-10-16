from channels.security.websocket import OriginValidator
from django.conf import settings


def allowed_websocket_origins() -> list[str]:
    """Browser origins allowed to open sockets: the same ones CORS allows, unless overridden."""
    configured = getattr(settings, "WEBSOCKET_ALLOWED_ORIGINS", None)
    return list(configured if configured else settings.CORS_ALLOWED_ORIGINS)


class SettingsOriginValidator(OriginValidator):
    """`OriginValidator` that reads the allowed origins from settings on every connection."""

    def __init__(self, application):
        super().__init__(application, allowed_origins=[])

    def valid_origin(self, parsed_origin):
        self.allowed_origins = allowed_websocket_origins()
        return super().valid_origin(parsed_origin)
