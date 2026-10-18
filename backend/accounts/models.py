from django.conf import settings
from django.db import models


class Profile(models.Model):
    PERSON = "person"
    ORGANIZATION = "organization"
    ACCOUNT_TYPES = [(PERSON, "Person"), (ORGANIZATION, "Organization")]

    STAGES = [("expecting", "Expecting"), ("parenting", "Parenting"), ("both", "Both")]
    USAGES = [("get", "Get support"), ("give", "Give support"), ("both", "Both")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)

    # A person's answers from profile setup (KAN-6). Blank until they finish it; organizations never fill them in.
    zip_code = models.CharField(max_length=5, blank=True)
    stage = models.CharField(max_length=10, choices=STAGES, blank=True)
    arrival_month = models.CharField(max_length=7, blank=True)  # YYYY-MM, only when expecting
    ages = models.JSONField(default=list, blank=True)  # one age group per child, never names or birth dates
    roles = models.JSONField(default=list, blank=True)
    needs = models.JSONField(default=list, blank=True)
    usage = models.CharField(max_length=4, choices=USAGES, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

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

    # Public profile (KAN-8). Shown to families on this organization's items.
    about = models.TextField(max_length=500, blank=True)
    serves = models.JSONField(default=list, blank=True)  # keys of resources.models.SERVES
    pickup_address = models.CharField(max_length=255, blank=True)
    zip_code = models.CharField(max_length=5, blank=True)  # from pickup_address, for search distance (KAN-15)
    public_contact = models.CharField(max_length=150, blank=True)

    @property
    def status(self):
        return "verified" if self.verified_at else "pending"

    def __str__(self):
        return f"{self.name} ({self.status})"
