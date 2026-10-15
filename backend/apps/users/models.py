from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.SUPER_ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super administrador"
        BRANCH_ADMIN = "branch_admin", "Administrador de sede"
        BRANCH_STAFF = "branch_staff", "Personal de sede"

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BRANCH_STAFF)
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users"
        ordering = ["name"]
        constraints = [
            # Super admins are global; every other role belongs to exactly one branch.
            models.CheckConstraint(
                condition=(Q(role="super_admin") & Q(branch__isnull=True))
                | (~Q(role="super_admin") & Q(branch__isnull=False)),
                name="user_branch_matches_role",
            ),
        ]

    def __str__(self):
        return f"{self.name} <{self.email}>"

    def clean(self):
        super().clean()
        if self.is_super_admin and self.branch_id is not None:
            raise ValidationError({"branch": "Un super administrador no pertenece a una sede."})
        if not self.is_super_admin and self.branch_id is None:
            raise ValidationError({"branch": "Este rol requiere una sede."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.name

    @property
    def is_super_admin(self) -> bool:
        return self.role == self.Role.SUPER_ADMIN

    @property
    def is_branch_admin(self) -> bool:
        return self.role == self.Role.BRANCH_ADMIN

    @property
    def is_branch_staff(self) -> bool:
        return self.role == self.Role.BRANCH_STAFF
