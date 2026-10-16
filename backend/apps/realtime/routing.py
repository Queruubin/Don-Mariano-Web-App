from django.urls import path

from apps.realtime.consumers import BranchConsumer

websocket_urlpatterns = [
    path("ws/branch/", BranchConsumer.as_asgi()),
]
