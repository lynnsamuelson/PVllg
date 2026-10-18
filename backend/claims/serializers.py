from rest_framework import serializers

from items.serializers import PublicItemSerializer

from .models import Claim


class ClaimSerializer(serializers.ModelSerializer):
    """A claim on My claims (Mock Up 15). The item goes through PublicItemSerializer, so its exact address follows
    the privacy rule (KAN-11): an Approved claimant sees it, a Waiting one doesn't. Needs context["request"]."""

    item = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = ["id", "status", "end_reason", "created_at", "held_until", "item"]

    def get_item(self, claim):
        return PublicItemSerializer(claim.item, context=self.context).data


class NewClaimSerializer(serializers.Serializer):
    item = serializers.IntegerField()
