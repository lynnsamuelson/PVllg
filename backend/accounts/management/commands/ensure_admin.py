"""Keeps the main admin login in step with the ADMIN_EMAIL and ADMIN_PASSWORD secrets, so nobody needs SSH."""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create or update a superuser from ADMIN_EMAIL and ADMIN_PASSWORD. The password always matches ADMIN_PASSWORD."

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "")
        if not (email and password):
            self.stdout.write("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping.")
            return
        user, created = User.objects.get_or_create(username=email, defaults={"email": email})
        user.is_active = user.is_staff = user.is_superuser = True
        user.set_password(password)
        user.save()
        self.stdout.write(f"{'Created' if created else 'Updated'} admin {email}.")
