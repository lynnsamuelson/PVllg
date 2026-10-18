"""KAN-26: replaces the four placeholder resources with the 12 real, checked programs in
data/organization-profiles.json. Facts are copied as given; null becomes blank ("Not listed").
Don't edit that file to change resources that already shipped: add a new migration (or edit them in admin)."""
import json
from pathlib import Path

from django.db import migrations

DATA = Path(__file__).resolve().parent.parent / "data" / "organization-profiles.json"

NEEDS = {
    "Diapers and Everyday Essentials": "essentials",
    "Food and Feeding Support": "feeding",
    "Parenting and Newborn Support": "parenting",
    "Housing and Family Stability": "housing",
}
LABELS = {
    "essentials": "Diapers & everyday essentials",
    "feeding": "Food & feeding support",
    "parenting": "Parenting & newborn support",
    "housing": "Housing & family stability",
}
# Regional and out-of-area programs are measured from their center ZIP, like local ones.
AREA_TYPES = {"local": "local", "regional": "local", "outside-radius": "local", "statewide": "statewide", "national": "national"}
PLACEHOLDERS = [
    ("Getting started guide", "Guide", "An overview of how to use PVllg.",
     "Longer description of the getting started guide goes here."),
    ("Community calendar", "Events", "Upcoming events and meetups.",
     "Longer description of the community calendar goes here."),
    ("Help center", "Support", "Answers to common questions.",
     "Longer description of the help center goes here."),
    ("Local services directory", "Directory", "Find services near you.",
     "Longer description of the services directory goes here."),
]


def organizations():
    return json.loads(DATA.read_text())["organizations"]


def text(value):
    return value or ""  # null means not listed


def load(apps, schema_editor):
    Resource = apps.get_model("resources", "Resource")
    Resource.objects.filter(title__in=[p[0] for p in PLACEHOLDERS]).delete()
    for org in organizations():
        categories = [NEEDS[n] for n in org["needs"]]
        ages = org["ageRange"]
        Resource.objects.update_or_create(
            title=org["name"],
            defaults={
                "category": LABELS[categories[0]],
                "categories": categories,
                "summary": text(org["about"]),
                "url": text(org["website"]),
                "serves": org["caregiverRoles"],
                "age_min_months": ages["minMonths"],
                "age_max_months": ages["maxMonths"],
                "age_text": text(ages["text"]),
                "area_type": AREA_TYPES[org["areaType"]],
                "zip_code": text(org["centerZip"]),
                "radius_miles": org["radiusMiles"],
                "limits": text(org["limits"]),
                "org_type": text(org["orgType"]),
                "area_served": text(org["areaServed"]),
                "who_we_serve": text(org["whoWeServe"]),
                "referral": text(org["referralOrAppointment"]),
                "next_step": text(org["nextStep"]),
                "public_address": text(org["publicAddress"]),
                "public_phone": text(org["publicPhone"]),
                "public_email": text(org["publicEmail"]),
                "contact_note": text(org.get("publicContactNote")),
                "source_url": text(org["sourceUrl"]),
                "last_checked": org["lastChecked"],
            },
        )


def unload(apps, schema_editor):
    Resource = apps.get_model("resources", "Resource")
    Resource.objects.filter(title__in=[org["name"] for org in organizations()]).delete()
    for title, category, summary, description in PLACEHOLDERS:
        Resource.objects.get_or_create(
            title=title, defaults={"category": category, "summary": summary, "description": description}
        )


class Migration(migrations.Migration):
    dependencies = [("resources", "0004_resource_card_facts")]
    operations = [migrations.RunPython(load, unload)]
