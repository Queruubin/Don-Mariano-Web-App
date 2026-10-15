from django.core.management.base import BaseCommand
from django.db import transaction

from apps.branches.models import Branch
from apps.common.seeding import seed_setting
from apps.users.models import User

BRANCHES = [
    {
        "slug": "centro",
        "name": "Don Mariano - Centro",
        "address": "Calle 10 #5-20, Bogotá",
        "phone": "3001112233",
    },
    {
        "slug": "norte",
        "name": "Don Mariano - Norte",
        "address": "Av. Calle 127 #15-40, Bogotá",
        "phone": "3002223344",
    },
]


class Command(BaseCommand):
    help = "Create the development branches with one branch admin and one staff user each."

    @transaction.atomic
    def handle(self, *args, **options):
        admin_password = seed_setting("SEED_BRANCH_ADMIN_PASSWORD")
        staff_password = seed_setting("SEED_BRANCH_STAFF_PASSWORD")

        for data in BRANCHES:
            branch, created = Branch.objects.get_or_create(
                name=data["name"], defaults={"address": data["address"], "phone": data["phone"]}
            )
            self._report(created, branch.name)

            users = [
                (f"admin.{data['slug']}@donmariano.local", f"Admin {data['slug'].title()}",
                 User.Role.BRANCH_ADMIN, admin_password),
                (f"staff.{data['slug']}@donmariano.local", f"Personal {data['slug'].title()}",
                 User.Role.BRANCH_STAFF, staff_password),
            ]
            for email, name, role, password in users:
                if User.objects.filter(email=email).exists():
                    self._report(False, email)
                    continue
                User.objects.create_user(
                    email=email, password=password, name=name, role=role, branch=branch
                )
                self._report(True, email)

    def _report(self, created: bool, label: str):
        if created:
            self.stdout.write(self.style.SUCCESS(f"[OK] {label}"))
        else:
            self.stdout.write(self.style.WARNING(f"[SKIP] {label} already exists"))
