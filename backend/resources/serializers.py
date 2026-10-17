from rest_framework import serializers

from .models import Resource


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = [
            "id", "title", "category", "categories", "summary", "description", "url", "area_type", "limits",
            "created_at",
        ]


class MatchQuerySerializer(serializers.Serializer):
    """Profile answers + search options for /api/resources/matches/. Lists are comma-separated."""

    zip = serializers.RegexField(r"^\d{5}$", error_messages={"invalid": "Enter a 5-digit ZIP code."})
    stage = serializers.ChoiceField(["expecting", "parenting", "both"], required=False)
    ages = serializers.CharField(required=False, default="")
    roles = serializers.CharField(required=False, default="")
    needs = serializers.CharField(required=False, default="")
    category = serializers.CharField(required=False, default="")
    q = serializers.CharField(required=False, default="", allow_blank=True)
    radius = serializers.ChoiceField([5, 10, 25, 50], required=False, default=10)

    def validate(self, attrs):
        for key in ("ages", "roles", "needs"):
            attrs[key] = [part for part in attrs[key].split(",") if part]
        return attrs
