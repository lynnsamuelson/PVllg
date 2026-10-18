"""Creates (or resets) the accounts product owners test with. Safe to run again: it puts each one back to its start."""
import getpass
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Organization, Profile

User = get_user_model()

# email, name, account type, Organization fields (None: hasn't started the email check)
TEST_ACCOUNTS = [
    ("person@pvill.test", "Test Person", Profile.PERSON, None),
    ("org@pvill.test", "Test Organization", Profile.ORGANIZATION,
     {"name": "Example Community Closet", "website": "example.org", "domain": "example.org",
      "work_email": "team@example.org"}),
    ("neworg@pvill.test", "Test New Organization", Profile.ORGANIZATION, None),
]


class Command(BaseCommand):
    help = "Create or reset the test accounts. The password comes from TEST_ACCOUNT_PASSWORD, or a prompt."

    def handle(self, *args, **options):
        password = os.environ.get("TEST_ACCOUNT_PASSWORD") or getpass.getpass("Password for the test accounts: ")
        if not password:
            raise CommandError("Set TEST_ACCOUNT_PASSWORD or type a password.")
        for email, name, account_type, org in TEST_ACCOUNTS:
            with transaction.atomic():
                user, _ = User.objects.update_or_create(username=email, defaults={"email": email, "first_name": name})
                user.set_password(password)
                user.save()
                Profile.objects.update_or_create(user=user, defaults={"account_type": account_type})
                Organization.objects.filter(user=user).delete()
                if org:
                    Organization.objects.create(user=user, verified_at=timezone.now(), **org)
            self.stdout.write(f"{email} ({account_type}{', verified' if org else ''})")
