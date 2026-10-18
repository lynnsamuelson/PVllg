"""Demo organizations, part 3: two more made-up Verified organizations, each with three sample items, read from
data/demo-organizations.json. Everything is fictional and flagged Profile.is_demo. The accounts get no usable
password: set one in admin.

Only adds rows. It never changes or removes earlier demo data, and skips any account that already exists.
Self-contained on purpose so later code changes can't alter it. Don't edit demo-organizations.json to change demo data
that already shipped: add a new migration.
"""
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from django.contrib.auth.hashers import make_password
from django.db import migrations
from django.utils import timezone

DATA = Path(__file__).resolve().parent.parent / "data" / "demo-organizations.json"

CATEGORIES = {"Clothes and gear": "clothes", "Diapers and wipes": "diapers", "Feeding supplies": "feeding",
              "Furniture": "furniture", "Other approved item": "other"}
SERVES = {"New parents": "parents", "Foster families": "foster", "Kinship caregivers": "kinship"}


def window(text):
    """(10:00, 14:00) from "10:00 am - 2:00 pm"."""
    return tuple(datetime.strptime(part.strip().upper(), "%I:%M %p").time() for part in text.split("-"))


def load(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Profile = apps.get_model("accounts", "Profile")
    Organization = apps.get_model("accounts", "Organization")
    Item = apps.get_model("items", "Item")
    data = json.loads(DATA.read_text())
    now = timezone.now()
    today = datetime.now(ZoneInfo("America/Chicago")).date()

    owners = {}  # only the ones made now, so items never land on an account someone else made
    for o in data["organizations"]:
        account, created = User.objects.get_or_create(
            username=o["demoEmail"],
            defaults={"email": o["demoEmail"], "first_name": o["name"], "password": make_password(None)},
        )
        if not created:
            continue
        Profile.objects.create(user=account, account_type="organization", is_demo=True)
        Organization.objects.create(
            user=account, name=o["name"], website=o["website"], domain=o["website"], work_email=o["demoEmail"],
            verified_at=now, about=o["about"], serves=[SERVES[s] for s in o["whoWeServe"]],
            pickup_address=o["publicAddress"], zip_code=o["zip"], public_contact=o["publicContact"],
        )
        owners[o["id"]] = (account, o["publicAddress"])

    for i in data["items"]:
        if i["giver"] not in owners:
            continue
        owner, address = owners[i["giver"]]
        start, end = window(i["pickupWindow"])
        Item.objects.create(
            owner=owner, name=i["name"], category=CATEGORIES[i["category"]], details=i["details"],
            quantity=i["quantity"], pickup_date=today + timedelta(days=i["pickupDayOffset"]),
            pickup_start=start, pickup_end=end, general_area=i["generalArea"], exact_address=address,
            zip_code=re.search(r"(\d{5})\s*$", address).group(1), where_to_go=i["whereToGo"],
            what_to_bring=i["whatToBring"],
        )


def unload(apps, schema_editor):
    """Removes the two organizations; their items go with them."""
    data = json.loads(DATA.read_text())
    apps.get_model("auth", "User").objects.filter(
        username__in=[o["demoEmail"] for o in data["organizations"]], profile__is_demo=True
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0007_demo_families"),
    ]
    operations = [migrations.RunPython(load, unload)]
