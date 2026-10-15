from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed development data: super admin, branches with their users, and products."

    def handle(self, *args, **options):
        call_command("create_superadmin")
        call_command("seed_branches")
        call_command("seed_products")
