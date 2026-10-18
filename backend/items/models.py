from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import models
from django.db.models import Count, F, IntegerField, Q
from django.db.models.functions import Cast

from claims.models import Claim

LOCAL_TZ = ZoneInfo("America/Chicago")  # the demo area is Middle Tennessee; the server runs in UTC


def local_today():
    return datetime.now(LOCAL_TZ).date()

# Item categories on Post an item (Mock Up 19).
CATEGORIES = {
    "clothes": "Clothes & gear",
    "diapers": "Diapers & wipes",
    "feeding": "Feeding supplies",
    "furniture": "Furniture",
    "other": "Other approved item",
}


class ItemQuerySet(models.QuerySet):
    def live(self):
        """Items families may find: not taken down (KAN-10). Use this in every list or search of items."""
        return self.filter(taken_down_at__isnull=True)

    def with_counts(self):
        """Adds `requested` (Waiting claims), `claimed` (Approved), `picked_up` and `left`: the number listed minus
        every claim that holds one. Canceled, declined and ended claims put theirs back (KAN-12)."""
        def claims(statuses):
            return Count("claims", filter=Q(claims__status__in=statuses))

        holding = [s for s in Claim.HOLDING if s not in (Claim.WAITING, Claim.APPROVED)]
        # quantity is unsigned on MySQL, which refuses a subtraction that goes below zero; cast it to signed first.
        return self.annotate(
            requested=claims([Claim.WAITING]), claimed=claims([Claim.APPROVED]), picked_up=claims(holding)
        ).annotate(
            left=Cast("quantity", IntegerField()) - F("requested") - F("claimed") - F("picked_up")
        )

    def public(self):
        """live() with counts and what the privacy rule reads about the giver, so lists don't query per item."""
        photo_ids = models.Prefetch("photos", queryset=ItemPhoto.objects.only("pk", "item_id"))
        return (
            self.live()
            .with_counts()
            .select_related("owner__profile", "owner__organization")
            .prefetch_related(photo_ids)
        )


PICKUP_FIELDS = ["pickup_date", "pickup_start", "pickup_end", "general_area", "exact_address", "where_to_go",
                 "what_to_bring"]  # when and where: editing these shows families "Pickup details changed" (KAN-19)


class Item(models.Model):
    """Something a giver posted (KAN-9). The exact address is private; KAN-11 decides who may see it."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=list(CATEGORIES.items()))
    details = models.TextField(max_length=1000)  # brand, size, age range, condition
    quantity = models.PositiveSmallIntegerField()
    pickup_date = models.DateField()
    pickup_start = models.TimeField()
    pickup_end = models.TimeField()
    general_area = models.CharField(max_length=100)  # shown to everyone, e.g. East Nashville
    exact_address = models.CharField(max_length=255)  # a person's is private; an organization's is its public address
    zip_code = models.CharField(max_length=5)  # from exact_address, for search distance (KAN-15)
    where_to_go = models.CharField(max_length=200, blank=True)
    what_to_bring = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    taken_down_at = models.DateTimeField(null=True, blank=True)  # set by Take down (KAN-10); hidden from search
    pickup_changed_at = models.DateTimeField(null=True, blank=True)  # last edit to when/where (KAN-19 change notice)
    paused_at = models.DateTimeField(null=True, blank=True)  # a family reported a pickup problem (KAN-20)
    paused_reason = models.CharField(max_length=30, blank=True)  # the reason they chose; the giver sees only this

    objects = ItemQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class ItemPhoto(models.Model):
    """Up to 4 per item. Kept in the database so the VM needs no media folder or web server change."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="photos")
    content_type = models.CharField(max_length=20)
    data = models.BinaryField()

    class Meta:
        ordering = ["id"]
