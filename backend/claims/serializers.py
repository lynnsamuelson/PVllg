from rest_framework import serializers

from items.serializers import PublicItemSerializer

from .models import Claim


class ClaimSerializer(serializers.ModelSerializer):
    """A claim on My claims (Mock Up 15). The item goes through PublicItemSerializer, so its exact address follows
    the privacy rule (KAN-11): an Approved claimant sees it, a Waiting one doesn't. Needs context["request"]."""

    item = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = ["id", "status", "end_reason", "created_at", "held_until", "pickup_changed", "item"]

    pickup_changed = serializers.SerializerMethodField()

    def get_pickup_changed(self, claim):
        """The giver changed when or where after the family claimed it or last added it to their calendar (KAN-19)."""
        changed = claim.item.pickup_changed_at
        return bool(changed and changed > max(claim.created_at, claim.calendar_added_at or claim.created_at))

    def get_item(self, claim):
        return PublicItemSerializer(claim.item, context=self.context).data


class NewClaimSerializer(serializers.Serializer):
    item = serializers.IntegerField()
