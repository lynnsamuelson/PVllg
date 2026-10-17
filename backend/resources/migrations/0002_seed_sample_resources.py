"""Loads the placeholder resources so the home page has something to show.
Edit or delete them in the Django admin (/admin/) once real content exists."""
from django.db import migrations

SAMPLES = [
    ("Getting started guide", "Guide", "An overview of how to use PVllg.",
     "Longer description of the getting started guide goes here."),
    ("Community calendar", "Events", "Upcoming events and meetups.",
     "Longer description of the community calendar goes here."),
    ("Help center", "Support", "Answers to common questions.",
     "Longer description of the help center goes here."),
    ("Local services directory", "Directory", "Find services near you.",
     "Longer description of the services directory goes here."),
]


def seed(apps, schema_editor):
    Resource = apps.get_model("resources", "Resource")
    for title, category, summary, description in SAMPLES:
        Resource.objects.get_or_create(
            title=title, defaults={"category": category, "summary": summary, "description": description}
        )


def unseed(apps, schema_editor):
    Resource = apps.get_model("resources", "Resource")
    Resource.objects.filter(title__in=[s[0] for s in SAMPLES]).delete()


class Migration(migrations.Migration):
    dependencies = [("resources", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
