"""Creates the first admin login on deploy, so nobody needs SSH to get into Django admin."""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create a superuser from ADMIN_EMAIL and ADMIN_PASSWORD if it doesn't exist yet. Never changes an existing one."

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "")
        if not (email and password):
            self.stdout.write("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping.")
        elif User.objects.filter(username=email).exists():
            self.stdout.write(f"{email} already exists; leaving it alone.")
        else:
            User.objects.create_superuser(email, email, password)
            self.stdout.write(f"Created admin {email}.")
