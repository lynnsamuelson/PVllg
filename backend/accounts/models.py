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
