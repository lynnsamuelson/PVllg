from django.conf import settings
from django.db import models


class Profile(models.Model):
    PERSON = "person"
    ORGANIZATION = "organization"
    ACCOUNT_TYPES = [(PERSON, "Person"), (ORGANIZATION, "Organization")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)

    def __str__(self):
        return f"{self.user.username} ({self.account_type})"


class Organization(models.Model):
    """An organization account's website and the state of its domain email check (KAN-7)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organization")
    name = models.CharField(max_length=150)
    website = models.CharField(max_length=255)
    domain = models.CharField(max_length=255)
    work_email = models.EmailField()
    verified_at = models.DateTimeField(null=True, blank=True)  # null while Pending
    code_hash = models.CharField(max_length=128, blank=True)
    code_sent_at = models.DateTimeField(null=True, blank=True)
    code_expires_at = models.DateTimeField(null=True, blank=True)
    code_attempts = models.PositiveSmallIntegerField(default=0)
    send_window_start = models.DateTimeField(null=True, blank=True)  # start of the current day for the send cap
    send_count = models.PositiveSmallIntegerField(default=0)

    @property
    def status(self):
        return "verified" if self.verified_at else "pending"

    def __str__(self):
        return f"{self.name} ({self.status})"
