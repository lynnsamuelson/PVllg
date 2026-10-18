"""A claim as the item's giver sees it. Its own module so items.serializers can import it without a cycle."""
from rest_framework import serializers

from .models import Claim


def first_name(user):
    return (user.first_name.split() or ["A family"])[0]


class RequestSerializer(serializers.ModelSerializer):
    """A claim as the item's giver sees it (Mock Up 21): only the family's first name, never more."""

    family = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = ["id", "status", "held_until", "family"]

    def get_family(self, claim):
        return first_name(claim.claimant)
