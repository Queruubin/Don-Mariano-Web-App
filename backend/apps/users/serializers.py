from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.auth import user_can_authenticate
from apps.users.models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["branch_id"] = user.branch_id
        return token


class ActiveUserTokenRefreshSerializer(TokenRefreshSerializer):
    """Refreshing a token re-checks that the user and their branch are still active."""

    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
        user = User.objects.select_related("branch").filter(pk=user_id).first()
        if not user_can_authenticate(user):
            raise AuthenticationFailed("Usuario o sede inactivos.", code="user_inactive")
        return super().validate(attrs)


class UserSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    password = serializers.CharField(
        write_only=True, required=False, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "role", "branch", "branch_name",
            "is_active", "date_joined", "password",
        ]
        read_only_fields = ["id", "date_joined", "is_active"]

    def validate_email(self, value):
        value = value.strip().lower()
        queryset = User.objects.filter(email__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo.")
        return value

    def validate(self, attrs):
        requester = self.context["request"].user
        role = attrs.get("role", getattr(self.instance, "role", User.Role.BRANCH_STAFF))
        branch = attrs.get("branch", getattr(self.instance, "branch", None))

        if requester.is_branch_admin:
            # FR-6: a branch admin only manages staff users of their own branch.
            if role != User.Role.BRANCH_STAFF:
                raise serializers.ValidationError(
                    {"role": ["Solo puede gestionar usuarios de personal de sede."]}
                )
            branch = requester.branch

        if role == User.Role.SUPER_ADMIN:
            branch = None
        elif branch is None:
            raise serializers.ValidationError({"branch": ["Este rol requiere una sede."]})

        attrs["role"], attrs["branch"] = role, branch

        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": ["La contraseña es obligatoria."]})
        if attrs.get("password"):
            validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class PasswordResetSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, value):
        validate_password(value)
        return value
