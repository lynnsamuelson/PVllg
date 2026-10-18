"""KAN-26 demo data helpers. Migration 0003 loads the made-up accounts and items from data/sample-data.json;
this moves their pickup dates forward again (Items admin → "Refresh demo pickup dates")."""
import json
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

from .models import local_today

DATA = Path(__file__).resolve().parent / "data" / "sample-data.json"


def offsets():
    """{(owner email, item name): days from today} for every sample item."""
    sample = json.loads(DATA.read_text())
    emails = {x["id"]: x["demoEmail"] for key in ("organizations", "people") for x in sample[key]}
    return {(emails[i["giver"]], i["name"]): i["pickupDayOffset"] for i in sample["items"]}


def refresh_dates(items):
    """Moves the selected demo items' pickup dates to their set days from today. Returns how many moved."""
    by_offset = defaultdict(list)
    days = offsets()
    for pk, owner, name in items.filter(owner__profile__is_demo=True).values_list("pk", "owner__username", "name"):
        if (owner, name) in days:
            by_offset[days[(owner, name)]].append(pk)
    for offset, pks in by_offset.items():
        items.model.objects.filter(pk__in=pks).update(pickup_date=local_today() + timedelta(days=offset))
    return sum(len(pks) for pks in by_offset.values())
