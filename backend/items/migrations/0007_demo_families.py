"""Demo families, part 2: four made-up families with different journeys (a 19-year-old aging out of foster care with
a newborn, a grandparent raising grandchildren, a single dad, a two-parent family expecting), four more sample items
with simple drawn photos, a photo for Morgan's bath tub, and claims that put each family's My claims in a set state.
Read from data/demo-families.json; givers and items named there are the KAN-26 ones from migration 0003.

Only adds rows. It never changes or removes anything 0003 loaded, and skips any account or item that already exists.
Self-contained on purpose so later code changes can't alter it. Don't edit demo-families.json to change demo data
that already shipped: add a new migration.
"""
import json
import re
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from django.contrib.auth.hashers import make_password
from django.db import migrations
from django.utils import timezone

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA = DATA_DIR / "demo-families.json"
SAMPLE = DATA_DIR / "sample-data.json"
PHOTOS = DATA_DIR / "demo-photos"
LOCAL_TZ = ZoneInfo("America/Chicago")
HOLD = timedelta(days=3)

CATEGORIES = {"Clothes and gear": "clothes", "Diapers and wipes": "diapers", "Feeding supplies": "feeding",
              "Furniture": "furniture", "Other approved item": "other"}
USAGE = {"Get support": "get", "Give support": "give", "Both": "both"}
AGE_GROUPS = {"Under 3 mo": "under_3mo", "3-12 mo": "3_12mo", "1-2 yrs": "1_2yrs", "3-5 yrs": "3_5yrs"}
ROLES = {"Parent": "parent", "Guardian": "guardian", "Kinship caregiver": "kinship", "Foster parent": "foster",
         "Adoptive parent": "adoptive"}
NEEDS = {"Diapers and Everyday Essentials": "essentials", "Food and Feeding Support": "feeding",
         "Parenting and Newborn Support": "parenting", "Housing and Family Stability": "housing"}


def window(text):
    """(10:00, 14:00) from "10:00 am - 2:00 pm"."""
    return tuple(datetime.strptime(part.strip().upper(), "%I:%M %p").time() for part in text.split("-"))


def month_after(today, months):
    """"YYYY-MM", `months` after today's month."""
    index = today.year * 12 + today.month - 1 + months
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def hold_until(now, pickup_date):
    """3 days from now, or the end of the pickup day if that's later (claims.actions.hold_until)."""
    return max(now + HOLD, datetime.combine(pickup_date + timedelta(days=1), time.min, tzinfo=LOCAL_TZ))


def load(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Profile = apps.get_model("accounts", "Profile")
    Item = apps.get_model("items", "Item")
    ItemPhoto = apps.get_model("items", "ItemPhoto")
    Claim = apps.get_model("claims", "Claim")
    data = json.loads(DATA.read_text())
    sample = json.loads(SAMPLE.read_text())
    now = timezone.now()
    today = datetime.now(LOCAL_TZ).date()

    givers = {}  # KAN-26 giver id -> their account, if it's there
    for key in ("organizations", "people"):
        for g in sample[key]:
            account = User.objects.filter(username=g["demoEmail"], profile__is_demo=True).first()
            if account:
                givers[g["id"]] = account

    families = {}  # only the ones made now, so claims never land on an account someone else made
    for f in data["families"]:
        account, created = User.objects.get_or_create(
            username=f["demoEmail"],
            defaults={"email": f["demoEmail"], "first_name": f["firstName"], "password": make_password(None)},
        )
        if not created:
            continue
        stage = f["journey"].lower()
        Profile.objects.create(
            user=account, account_type="person", zip_code=f["zip"], stage=stage,
            arrival_month=month_after(today, f["arrivalMonthOffset"]) if stage in ("expecting", "both") else "",
            ages=[AGE_GROUPS[a] for a in f["childAgeGroups"]], roles=[ROLES[r] for r in f["roles"]],
            needs=[NEEDS[n] for n in f["needs"]], usage=USAGE[f["howToUse"]], completed_at=now, is_demo=True,
        )
        families[f["id"]] = account

    def add_photo(item, filename):
        ItemPhoto.objects.create(item=item, content_type="image/png", data=(PHOTOS / filename).read_bytes())

    for i in data["items"]:
        owner = givers.get(i["giver"])
        if owner is None or Item.objects.filter(owner=owner, name=i["name"]).exists():
            continue
        org = getattr(owner, "organization", None)
        address = org.pickup_address if org else i["exactAddress"]
        start, end = window(i["pickupWindow"])
        item = Item.objects.create(
            owner=owner, name=i["name"], category=CATEGORIES[i["category"]], details=i["details"],
            quantity=i["quantity"], pickup_date=today + timedelta(days=i["pickupDayOffset"]),
            pickup_start=start, pickup_end=end, general_area=i["generalArea"], exact_address=address,
            zip_code=re.search(r"(\d{5})\s*$", address).group(1), where_to_go=i["whereToGo"],
            what_to_bring=i["whatToBring"],
        )
        add_photo(item, i["photo"])

    for p in data["photosForExistingItems"]:
        item = Item.objects.filter(owner=givers.get(p["giver"]), name=p["name"]).first()
        if item and not ItemPhoto.objects.filter(item=item).exists():
            add_photo(item, p["photo"])

    for c in data["claims"]:
        family = families.get(c["family"])
        item = Item.objects.filter(owner=givers.get(c["giver"]), name=c["item"], taken_down_at__isnull=True).first()
        if family is None or item is None:
            continue
        made = now - timedelta(days=c.get("createdDaysAgo", 0))
        active = c["status"] in ("waiting", "approved")
        claim = Claim.objects.create(
            item=item, claimant=family, status=c["status"], end_reason=c.get("endReason", ""),
            held_until=hold_until(made, item.pickup_date) if active else made + HOLD,  # a past hold ended in the past
        )
        Claim.objects.filter(pk=claim.pk).update(created_at=made)  # auto_now_add ignores a value passed in


def unload(apps, schema_editor):
    """Removes only what load added: the four families (their claims go with them), the new items and the tub photo."""
    data = json.loads(DATA.read_text())
    sample = json.loads(SAMPLE.read_text())
    User = apps.get_model("auth", "User")
    Item = apps.get_model("items", "Item")
    emails = {g["id"]: g["demoEmail"] for key in ("organizations", "people") for g in sample[key]}
    User.objects.filter(username__in=[f["demoEmail"] for f in data["families"]], profile__is_demo=True).delete()
    for i in data["items"]:
        Item.objects.filter(owner__username=emails[i["giver"]], owner__profile__is_demo=True, name=i["name"]).delete()
    for p in data["photosForExistingItems"]:
        apps.get_model("items", "ItemPhoto").objects.filter(
            item__owner__username=emails[p["giver"]], item__owner__profile__is_demo=True, item__name=p["name"]
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0006_item_report"),
        ("claims", "0006_pickup_problem"),
        ("accounts", "0005_profile_is_demo"),
    ]
    operations = [migrations.RunPython(load, unload)]
