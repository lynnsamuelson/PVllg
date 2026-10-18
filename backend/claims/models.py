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
    # Why a claim ended as Ended (KAN-14), so Past can say it.
    HOLD_ENDED = "hold_ended"  # the 3-day hold passed with no pickup
    NO_ANSWER = "no_answer"  # a request on a person's item had no answer for 2 days
    NO_SHOW = "no_show"  # the giver tapped Family didn't come
    REASONS = [
        (HOLD_ENDED, "The hold ended"),  # the family's Past tab words these in MyClaimsPage.jsx
        (NO_ANSWER, "The giver didn't answer in time"),
        (NO_SHOW, "The giver marked it not picked up"),
    ]

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
    end_reason = models.CharField(max_length=20, choices=REASONS, blank=True)  # why an Ended claim ended (KAN-14)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["claimant", "status"]),  # the privacy rule's lookup
            models.Index(fields=["status", "held_until"]),  # expire_overdue
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.claimant} → {self.item} ({self.status})"
