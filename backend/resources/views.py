from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .matching import match_resources
from .models import Resource
from .serializers import MatchQuerySerializer, ResourceSerializer


class ResourceViewSet(viewsets.ReadOnlyModelViewSet):
    """Logged-in users can list and view resources (login enforced by the global default
    permission). Add/edit resources in the Django admin."""

    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer

    @action(detail=False)
    def matches(self, request):
        """KAN-16: resources ranked for a profile. Profile answers come in as query params until the
        profile is saved server-side (KAN-6); then this can read request.user's profile instead."""
        params = MatchQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        opts = params.validated_data
        profile = {key: opts.get(key) for key in ("zip", "stage", "ages", "roles", "needs")}

        results = match_resources(
            self.get_queryset(), profile, category=opts["category"] or None, query=opts["q"], radius=opts["radius"]
        )
        return Response(
            [
                dict(
                    ResourceSerializer(r["resource"]).data,
                    distance_miles=r["distance_miles"],
                    matches_needs=r["matches_needs"],
                    reason=r["reason"],
                )
                for r in results
            ]
        )
