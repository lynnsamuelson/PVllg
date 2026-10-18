from rest_framework import serializers

from items.serializers import PublicItemSerializer

from .models import Claim, PickupReport


class ClaimSerializer(serializers.ModelSerializer):
    """A claim on My claims (Mock Up 15). The item goes through PublicItemSerializer, so its exact address follows
    the privacy rule (KAN-11): an Approved claimant sees it, a Waiting one doesn't. Needs context["request"]."""

    item = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = ["id", "status", "end_reason", "created_at", "held_until", "pickup_changed", "can_report", "item"]

    pickup_changed = serializers.SerializerMethodField()
    can_report = serializers.SerializerMethodField()

    def get_can_report(self, claim):
        """Problem with pickup shows on an Approved claim from the window's start until a day after (KAN-20)."""
        from .actions import can_report  # actions imports this app's models and items; keep this module light

        return can_report(claim)

    def get_pickup_changed(self, claim):
        """The giver changed when or where after the family claimed it or last added it to their calendar (KAN-19)."""
        changed = claim.item.pickup_changed_at
        return bool(changed and changed > max(claim.created_at, claim.calendar_added_at or claim.created_at))

    def get_item(self, claim):
        return PublicItemSerializer(claim.item, context=self.context).data


class ReportSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=PickupReport.REASONS, error_messages={"invalid_choice": "Pick a reason."})
    note = serializers.CharField(max_length=200, required=False, allow_blank=True)


class NewClaimSerializer(serializers.Serializer):
    item = serializers.IntegerField()
