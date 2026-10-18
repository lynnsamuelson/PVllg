"""KAN-26 demo data helpers. Migrations 0003, 0007 and 0008 load the made-up accounts, items and claims from
data/sample-data.json, demo-families.json and demo-organizations.json; this moves their pickup dates forward again,
and restarts the clock on demo families' active claims so they don't run out (Items admin → "Refresh demo pickup
dates")."""
import json
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

from django.utils import timezone

from claims.actions import hold_until
from claims.models import Claim

from .models import local_today

DATA = Path(__file__).resolve().parent / "data" / "sample-data.json"
FAMILIES = Path(__file__).resolve().parent / "data" / "demo-families.json"
ORGANIZATIONS = Path(__file__).resolve().parent / "data" / "demo-organizations.json"


def offsets():
    """{(owner email, item name): days from today} for every sample item."""
    sample = json.loads(DATA.read_text())
    more_orgs = json.loads(ORGANIZATIONS.read_text())
    emails = {x["id"]: x["demoEmail"] for x in sample["organizations"] + sample["people"] + more_orgs["organizations"]}
    items = sample["items"] + json.loads(FAMILIES.read_text())["items"] + more_orgs["items"]
    return {(emails[i["giver"]], i["name"]): i["pickupDayOffset"] for i in items}


def refresh_dates(items):
    """Moves the selected demo items' pickup dates to their set days from today, then restarts demo families' active
    claims on them: a Waiting request as if made now, an Approved hold from now. Returns how many items moved."""
    by_offset = defaultdict(list)
    days = offsets()
    for pk, owner, name in items.filter(owner__profile__is_demo=True).values_list("pk", "owner__username", "name"):
        if (owner, name) in days:
            by_offset[days[(owner, name)]].append(pk)
    for offset, pks in by_offset.items():
        items.model.objects.filter(pk__in=pks).update(pickup_date=local_today() + timedelta(days=offset))
    moved = [pk for pks in by_offset.values() for pk in pks]
    active = Claim.objects.filter(item__in=moved, claimant__profile__is_demo=True, status__in=Claim.ACTIVE)
    for claim in active.select_related("item"):
        Claim.objects.filter(pk=claim.pk).update(created_at=timezone.now(), held_until=hold_until(claim.item))
    return len(moved)
