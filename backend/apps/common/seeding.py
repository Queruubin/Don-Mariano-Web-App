import os

DEV_DEFAULTS = {
    "SEED_SUPERADMIN_EMAIL": "admin@donmariano.local",
    "SEED_SUPERADMIN_PASSWORD": "DonMariano2026!",
    "SEED_BRANCH_ADMIN_PASSWORD": "SedeAdmin2026!",
    "SEED_BRANCH_STAFF_PASSWORD": "SedeStaff2026!",
}


def seed_setting(name: str) -> str:
    """Seed credentials come from the environment, with development defaults."""
    return os.environ.get(name) or DEV_DEFAULTS[name]
