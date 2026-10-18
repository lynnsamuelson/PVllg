"""KAN-26: made-up demo organizations, people, family logins and sample items from data/sample-data.json.
Everything is fictional and flagged Profile.is_demo. The accounts get no usable password: set one in admin.

Self-contained on purpose so later code changes can't alter it. Don't edit sample-data.json to change demo data
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

DATA = Path(__file__).resolve().parent.parent / "data" / "sample-data.json"

CATEGORIES = {"Clothes and gear": "clothes", "Diapers and wipes": "diapers", "Feeding supplies": "feeding",
              "Furniture": "furniture", "Other approved item": "other"}
SERVES = {"New parents": "parents", "Foster families": "foster", "Kinship caregivers": "kinship"}
USAGE = {"Get support": "get", "Give support": "give", "Both": "both"}
AGE_GROUPS = {"Under 3 mo": "under_3mo", "3-12 mo": "3_12mo", "1-2 yrs": "1_2yrs", "3-5 yrs": "3_5yrs"}
ROLES = {"Parent": "parent", "Guardian": "guardian", "Kinship caregiver": "kinship", "Foster parent": "foster",
         "Adoptive parent": "adoptive"}
NEEDS = {"Diapers and Everyday Essentials": "essentials", "Food and Feeding Support": "feeding",
         "Parenting and Newborn Support": "parenting", "Housing and Family Stability": "housing"}


def window(text):
    """(10:00, 14:00) from "10:00 am - 2:00 pm"."""
    return tuple(datetime.strptime(part.strip().upper(), "%I:%M %p").time() for part in text.split("-"))


def emails(sample):
    return [x["demoEmail"] for key in ("organizations", "people", "demoFamilyLogins") for x in sample[key]]


def load(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Profile = apps.get_model("accounts", "Profile")
    Organization = apps.get_model("accounts", "Organization")
    Item = apps.get_model("items", "Item")
    sample = json.loads(DATA.read_text())
    now = timezone.now()
    today = datetime.now(ZoneInfo("America/Chicago")).date()

    def user(email, name):
        account, created = User.objects.get_or_create(
            username=email, defaults={"email": email, "first_name": name, "password": make_password(None)}
        )
        return account if created else None  # never touch an account that already exists

    owners = {}
    for o in sample["organizations"]:
        account = user(o["demoEmail"], o["name"])
        if account:
            Profile.objects.create(user=account, account_type="organization", is_demo=True)
            Organization.objects.create(
                user=account, name=o["name"], website=o["website"], domain=o["website"], work_email=o["demoEmail"],
                verified_at=now, about=o["about"], serves=[SERVES[s] for s in o["whoWeServe"]],
                pickup_address=o["publicAddress"], zip_code=o["zip"], public_contact=o["publicContact"],
            )
            owners[o["id"]] = (account, o["publicAddress"])
    for p in sample["people"]:
        account = user(p["demoEmail"], p["firstName"])
        if account:
            Profile.objects.create(
                user=account, account_type="person", zip_code=p["zip"], usage=USAGE[p["howToUse"]],
                completed_at=now, is_demo=True,
            )
            owners[p["id"]] = (account, None)
    for f in sample["demoFamilyLogins"]:
        account = user(f["demoEmail"], f["firstName"])
        if account:
            Profile.objects.create(
                user=account, account_type="person", zip_code=f["zip"], stage=f["journey"].lower(),
                ages=[AGE_GROUPS[a] for a in f["childAgeGroups"]], roles=[ROLES[r] for r in f["roles"]],
                needs=[NEEDS[n] for n in f["needs"]], usage=USAGE[f["howToUse"]], completed_at=now, is_demo=True,
            )

    for i in sample["items"]:
        if i["giver"] not in owners:
            continue
        owner, org_address = owners[i["giver"]]
        address = org_address or i["exactAddress"]
        start, end = window(i["pickupWindow"])
        Item.objects.create(
            owner=owner, name=i["name"], category=CATEGORIES[i["category"]], details=i["details"],
            quantity=i["quantity"], pickup_date=today + timedelta(days=i["pickupDayOffset"]),
            pickup_start=start, pickup_end=end, general_area=i["generalArea"], exact_address=address,
            zip_code=re.search(r"(\d{5})\s*$", address).group(1), where_to_go=i["whereToGo"],
            what_to_bring=i["whatToBring"],
        )


def unload(apps, schema_editor):
    sample = json.loads(DATA.read_text())
    apps.get_model("auth", "User").objects.filter(username__in=emails(sample)).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0002_item_taken_down"),
        ("accounts", "0005_profile_is_demo"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]
    operations = [migrations.RunPython(load, unload)]
