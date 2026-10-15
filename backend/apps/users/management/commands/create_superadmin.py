from django.core.management.base import BaseCommand

from apps.common.seeding import seed_setting
from apps.users.models import User


class Command(BaseCommand):
    help = "Create the super admin from SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD."

    def handle(self, *args, **options):
        email = seed_setting("SEED_SUPERADMIN_EMAIL").lower()
        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f"[SKIP] {email} already exists"))
            return
        User.objects.create_superuser(
            email=email,
            password=seed_setting("SEED_SUPERADMIN_PASSWORD"),
            name="Administrador General",
        )
        self.stdout.write(self.style.SUCCESS(f"[OK] super admin {email}"))
