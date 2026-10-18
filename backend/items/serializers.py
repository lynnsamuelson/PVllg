from rest_framework import serializers

from accounts.serializers import address_zip

from claims.giver import RequestSerializer

from . import privacy
from .models import CATEGORIES, Item, local_today

MAX_PHOTOS = 4
MAX_PHOTO_BYTES = 5 * 1024 * 1024
TICKS = "Check both boxes to post."
NO_ORG_ADDRESS = "Add your public pickup address to your organization profile first."


def photo_type(head):
    """The image type from a file's first bytes, or None if it isn't a JPEG, PNG or WebP."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


class ItemSerializer(serializers.ModelSerializer):
    """Post an item (Mock Ups 19-20). `exact_address` is required from people; organizations use their profile's."""

    good_condition = serializers.BooleanField(write_only=True)
    not_recalled = serializers.BooleanField(write_only=True)
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    # Write-only: a person's exact address is private (KAN-11 decides who may see it).
    exact_address = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            "id", "name", "category", "details", "quantity", "good_condition", "not_recalled", "photos",
            "pickup_date", "pickup_start", "pickup_end", "general_area", "exact_address", "where_to_go",
            "what_to_bring", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_photos(self, item):
        return [f"/api/items/photos/{pk}/" for pk in item.photos.values_list("pk", flat=True)]

    def validate_good_condition(self, value):
        if not value:
            raise serializers.ValidationError(TICKS)
        return value

    def validate_not_recalled(self, value):
        if not value:
            raise serializers.ValidationError(TICKS)
        return value

    def validate_pickup_date(self, value):
        if value < local_today():
            raise serializers.ValidationError("Pick a date that hasn't passed.")
        return value

    def validate(self, attrs):
        if attrs["pickup_end"] <= attrs["pickup_start"]:
            raise serializers.ValidationError({"pickup_end": ["End the window after it starts."]})
        org = self.context["organization"]
        if org:
            if not address_zip(org.pickup_address):
                raise serializers.ValidationError(NO_ORG_ADDRESS)
            attrs["exact_address"] = org.pickup_address
            attrs["zip_code"] = address_zip(org.pickup_address)
        else:
            address = attrs.get("exact_address", "").strip()
            if not address:
                raise serializers.ValidationError({"exact_address": ["Add the exact address."]})
            if not address_zip(address):
                raise serializers.ValidationError(
                    {"exact_address": ["End the address with its ZIP code, like 12 Sample Ave, Nashville, TN 37206."]}
                )
            attrs["exact_address"] = address
            attrs["zip_code"] = address_zip(address)
        attrs.pop("good_condition")
        attrs.pop("not_recalled")
        return attrs


class PublicItemSerializer(serializers.ModelSerializer):
    """An item as anyone signed in sees it (search, item details). Applies the privacy rule (items.privacy):
    `exact_address` and `where_to_go` are null unless the viewer may see them. Needs context["request"]."""

    giver = serializers.SerializerMethodField()
    from_organization = serializers.SerializerMethodField()
    demo = serializers.SerializerMethodField()
    distance_miles = serializers.SerializerMethodField()
    exact_address = serializers.SerializerMethodField()
    where_to_go = serializers.SerializerMethodField()
    private_note = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()
    left = serializers.IntegerField(read_only=True)  # from Item.objects.public()

    class Meta:
        model = Item
        fields = [
            "id", "name", "category", "details", "quantity", "left", "photos", "pickup_date", "pickup_start",
            "pickup_end",
            "general_area", "what_to_bring", "giver", "from_organization", "demo", "distance_miles", "exact_address",
            "where_to_go", "private_note", "available", "mine",
        ]

    def to_representation(self, item):
        user = self.context["request"].user
        if not hasattr(self, "_approved"):  # one claims query for a whole list, or the caller's
            self._approved = self.context.get("approved_item_ids")
            if self._approved is None:
                self._approved = privacy.approved_item_ids(user)
        self._visible = privacy.can_see_exact_address(user, item, approved=self._approved)
        return super().to_representation(item)

    def get_giver(self, item):
        return privacy.giver_name(item)

    def get_from_organization(self, item):
        return privacy.from_organization(item)

    def get_demo(self, item):
        """Made-up sample data (KAN-26): show it with a Demo badge."""
        profile = getattr(item.owner, "profile", None)
        return bool(profile and profile.is_demo)

    def get_distance_miles(self, item):
        return privacy.rounded_miles(self.context["request"].user, item)

    def get_exact_address(self, item):
        return item.exact_address if self._visible else None

    def get_where_to_go(self, item):
        return item.where_to_go if self._visible else None

    def get_private_note(self, item):
        return None if self._visible else privacy.PRIVATE_NOTE

    def get_available(self, item):
        """Can it still be claimed: some left and its pickup day hasn't passed."""
        return item.left > 0 and item.pickup_date >= local_today()

    def get_mine(self, item):
        return item.owner_id == self.context["request"].user.pk

    def get_photos(self, item):
        # Prefetched as ids only (Item.objects.public() doesn't load photo data).
        return [f"/api/items/photos/{photo.pk}/" for photo in item.photos.all()]


# Search chips (Mock Up 12) -> item categories. Housing has no items; its results are resources.
CHIP_CATEGORIES = {
    "essentials": ["diapers", "clothes"],
    "feeding": ["feeding"],
    "parenting": ["furniture"],
    "housing": [],
}


class ItemSearchSerializer(serializers.Serializer):
    q = serializers.CharField(required=False, default="", allow_blank=True, max_length=100)
    category = serializers.ChoiceField(list(CHIP_CATEGORIES), required=False, default="", allow_blank=True)
    radius = serializers.ChoiceField([5, 10, 25, 50], required=False, default=10)


class OwnItemSerializer(ItemSerializer):
    """An item as its giver sees it on My items and Edit (KAN-10): with the exact address and the counts from
    Item.objects.with_counts()."""

    exact_address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    left = serializers.IntegerField(read_only=True)
    requested = serializers.IntegerField(read_only=True)
    claimed = serializers.IntegerField(read_only=True)
    claims = serializers.SerializerMethodField()

    class Meta(ItemSerializer.Meta):
        # No photos: My items doesn't show them, and listing them costs a query per item.
        fields = [*(f for f in ItemSerializer.Meta.fields if f != "photos"), "left", "requested", "claimed", "claims"]

    def get_claims(self, item):
        """Current claims (Waiting requests to answer, Approved ones to mark picked up), first names only.
        own_items() prefetches only current claims, oldest first."""
        return RequestSerializer(item.claims.all(), many=True).data

    def validate_quantity(self, value):
        held = self.instance and self.instance.requested + self.instance.claimed + self.instance.picked_up
        if held and value < held:
            raise serializers.ValidationError(f"{held} are already claimed or requested, so list at least {held}.")
        return value


def check_photos(files):
    """[(content_type, bytes)] for the uploaded photos, or raises a ValidationError keyed `photos`."""
    if len(files) > MAX_PHOTOS:
        raise serializers.ValidationError({"photos": [f"Add up to {MAX_PHOTOS} photos."]})
    photos = []
    for f in files:
        if f.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError({"photos": [f"{f.name} is too big. Use photos under 5 MB."]})
        data = f.read()
        kind = photo_type(data[:12])
        if not kind:
            raise serializers.ValidationError({"photos": [f"{f.name} isn't a photo. Use JPEG, PNG or WebP."]})
        photos.append((kind, data))
    return photos
