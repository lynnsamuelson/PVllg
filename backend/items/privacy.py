"""The address privacy rule (KAN-11). Every screen, search, calendar file or message that could show where an item
is picked up asks these functions; nothing else decides it.

- A Verified organization's public address can always be seen.
- A person's exact address and Where to go are seen only by the giver and by the family with an Approved claim,
  until that claim ends (declined, canceled, ended or picked up) or the day after the pickup date.
- Everyone else sees the general area, a whole-mile distance and "A parent nearby" instead of the giver's name.
"""
import math
from datetime import timedelta

from accounts.models import Profile
from claims.models import Claim
from resources.matching import ZIP_CENTERS, miles_between

from .models import local_today

PRIVATE_NOTE = "Private. The exact pickup place is shared only after the giver approves your request."


def verified_organization(item):
    """The giver's Organization if it is a Verified organization, else None."""
    profile = getattr(item.owner, "profile", None)
    if not profile or profile.account_type != Profile.ORGANIZATION:
        return None
    org = getattr(item.owner, "organization", None)
    return org if org and org.verified_at else None


def from_organization(item):
    return verified_organization(item) is not None


def approved_item_ids(user):
    """Ids of items this user has an Approved claim on."""
    if not user.is_authenticated:
        return set()
    return set(Claim.objects.filter(claimant=user, status=Claim.APPROVED).values_list("item_id", flat=True))


def can_see_exact_address(user, item, approved=None):
    """Can this user see this item's exact address (and Where to go) right now?
    `approved`: approved_item_ids(user), when checking many items."""
    if from_organization(item):
        return True
    if not user.is_authenticated:
        return False
    if item.owner_id == user.pk:
        return True
    if item.taken_down_at or item.pickup_date < local_today() - timedelta(days=1):
        return False  # the claim is over once the item is taken down or its pickup day has passed
    return item.pk in (approved if approved is not None else approved_item_ids(user))


PERSON_GIVER = "A parent nearby"  # Mock Ups 12 and 14: a person giver is never named


def giver_name(item):
    """The organization's name, or "A parent nearby" for a person."""
    org = verified_organization(item)
    return org.name if org else PERSON_GIVER


def user_zip(user):
    """A person's profile ZIP, or an organization's, or ""."""
    profile = getattr(user, "profile", None)
    org = getattr(user, "organization", None)
    return (profile.zip_code if profile else "") or (org.zip_code if org else "")


def miles(user, item):
    """Unrounded miles from the user's ZIP to the item's, or None if either is unknown. Only for comparing with a
    radius on the server; never send it to a client (use rounded_miles)."""
    return miles_between(user_zip(user), item.zip_code)


def zips_within(user, radius):
    """ZIP codes whose centers are within `radius` miles of the user's, to narrow a search before checking each item."""
    home = user_zip(user)
    distances = {z: miles_between(home, z) for z in ZIP_CENTERS}
    return [z for z, d in distances.items() if d is not None and d <= radius]


def rounded_miles(user, item):
    """Whole miles (halves round up) from the user's ZIP to the item's, at least 1, or None if either is unknown."""
    exact = miles(user, item)
    return None if exact is None else max(1, math.floor(exact + 0.5))
