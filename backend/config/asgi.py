"""ASGI entry point: HTTP through Django, WebSockets through Channels (PRD FR-30).

Run it with `manage.py runserver` in development (daphne is installed as an app)
or `daphne config.asgi:application` in production.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

# Initialize Django before importing code that touches models.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.realtime.routing import websocket_urlpatterns  # noqa: E402
from apps.realtime.security import SettingsOriginValidator  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": SettingsOriginValidator(URLRouter(websocket_urlpatterns)),
    }
)
