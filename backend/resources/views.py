from rest_framework import viewsets

from .models import Resource
from .serializers import ResourceSerializer


class ResourceViewSet(viewsets.ReadOnlyModelViewSet):
    """Logged-in users can list and view resources (login enforced by the global default
    permission). Add/edit resources in the Django admin."""

    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer
