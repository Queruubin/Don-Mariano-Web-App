from .base import *  # noqa: F401,F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
REALTIME = {
    "AUTH_TIMEOUT": 0.3,
    "IDLE_TIMEOUT": 0.6,
    "REVALIDATE_INTERVAL": 60,
    "TICK": 0.05,
    "PUBLISH_TIMEOUT": 1,
    "FAILURE_COOLDOWN": 0,
}
