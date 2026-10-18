from django.conf import settings
from django.db import models


class Claim(models.Model):
    """A family's hold on one item. The privacy rule (KAN-11) reads it; claiming (KAN-12) and approving (KAN-13)
    write it. Only an Approved claim shows the family a person's exact address."""

    WAITING = "waiting"
    APPROVED = "approved"
    DECLINED = "declined"
    CANCELED = "canceled"
    ENDED = "ended"  # expired or the family didn't come (KAN-14)
    PICKED_UP = "picked_up"
    ACTIVE = [WAITING, APPROVED]  # current claims (My claims: Active)
    HOLDING = [WAITING, APPROVED, PICKED_UP]  # claims that use up one of the item; the others put it back
    STATUSES = [
        (WAITING, "Waiting"),
        (APPROVED, "Approved"),
        (DECLINED, "Declined"),
        (CANCELED, "Canceled"),
        (ENDED, "Ended"),
        (PICKED_UP, "Picked up"),
    ]

    item = models.ForeignKey("items.Item", on_delete=models.CASCADE, related_name="claims")
    claimant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="claims")
    status = models.CharField(max_length=10, choices=STATUSES, default=WAITING)
    created_at = models.DateTimeField(auto_now_add=True)
    held_until = models.DateTimeField(null=True, blank=True)  # end of the 3-day hold (KAN-12; the PO may change it)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["claimant", "status"])]  # the privacy rule's lookup

    def __str__(self):
        return f"{self.claimant} → {self.item} ({self.status})"
