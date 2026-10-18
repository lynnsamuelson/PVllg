"""Impact numbers for an organization (KAN-23, Mock Up 10): what its items did for families in the last 30 days."""
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from claims.models import Claim

from .models import CATEGORIES, Item

WINDOW = timedelta(days=30)

# Dollars saved per item picked up, by category. PLACEHOLDERS until the PO supplies the real values (KAN-23);
# the screen labels the total "Estimated savings" and says it uses a set value per item type.
SAVINGS_PER_ITEM = {"diapers": 15, "clothes": 20, "feeding": 25, "furniture": 60, "other": 10}
assert set(SAVINGS_PER_ITEM) == set(CATEGORIES), "every item category needs a savings value"

# The made-up numbers a demo organization shows, labeled Example data (Mock Up 10).
EXAMPLE = {
    "families_helped": 18, "items_posted": 42, "items_claimed": 30, "items_picked_up": 24, "returned_to_list": 6,
    "estimated_savings": 620,
}


def impact(owner, now=None):
    """Claimed = claims approved in the window (organization items are approved at once); of those, some were picked
    up and the rest are still waiting for pickup or went back on the list (canceled, missed, or reported).
    Requests that were declined or never answered were never claimed, so they count in neither."""
    since = (now or timezone.now()) - WINDOW
    claims = Claim.objects.filter(item__owner=owner)
    picked_up = claims.filter(status=Claim.PICKED_UP, picked_up_at__gte=since)
    approved = claims.filter(approved_at__gte=since)
    savings = sum(SAVINGS_PER_ITEM[category] for category in picked_up.values_list("item__category", flat=True))
    return {
        "families_helped": picked_up.values("claimant").distinct().count(),  # a family counts once
        "items_posted": Item.objects.filter(owner=owner, created_at__gte=since).aggregate(n=Sum("quantity"))["n"] or 0,
        "items_claimed": approved.count(),
        "items_picked_up": picked_up.count(),
        "returned_to_list": approved.filter(status__in=[Claim.CANCELED, Claim.ENDED]).count(),
        "estimated_savings": savings,
    }
