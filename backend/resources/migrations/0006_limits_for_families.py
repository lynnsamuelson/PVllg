"""The starter data's limits for the two out-of-area diaper banks held a note to developers ("Show only when the
person widens the distance.") that reached the screen. Says the same thing in words for families, using each
program's own area served."""
from django.db import migrations

LIMITS = {
    "Sweet Cheeks Diaper Bank": (
        "Not statewide Kentucky coverage. Show only when the person widens the distance.",
        "Only for the Greater Cincinnati and Northern Kentucky area. Not statewide Kentucky coverage.",
    ),
    "Food Bank of North Alabama Diaper Bank": (
        "Show only when the person widens the distance.",
        "Only for North Alabama.",
    ),
}


def forward(apps, schema_editor):
    Resource = apps.get_model("resources", "Resource")
    for title, (old, new) in LIMITS.items():
        Resource.objects.filter(title=title, limits=old).update(limits=new)


def backward(apps, schema_editor):
    Resource = apps.get_model("resources", "Resource")
    for title, (old, new) in LIMITS.items():
        Resource.objects.filter(title=title, limits=new).update(limits=old)


class Migration(migrations.Migration):
    dependencies = [("resources", "0005_starter_resources")]
    operations = [migrations.RunPython(forward, backward)]
