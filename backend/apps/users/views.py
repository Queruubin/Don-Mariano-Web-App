from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.permissions import IsBranchAdminOrAbove
from apps.users.models import User
from apps.users.serializers import (
    CustomTokenObtainPairSerializer,
    PasswordResetSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class MeView(RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UserViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Super admins manage every user; branch admins manage staff of their own branch.

    Users outside the requester's reach are not found (404). DELETE deactivates.
    """

    serializer_class = UserSerializer
    permission_classes = [IsBranchAdminOrAbove]

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.select_related("branch")
        if user.is_super_admin:
            branch_id = self.request.query_params.get("branch")
            return queryset.filter(branch_id=branch_id) if branch_id else queryset
        return queryset.filter(branch=user.branch, role=User.Role.BRANCH_STAFF)

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError({"detail": "No puede desactivar su propio usuario."})
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)
