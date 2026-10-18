from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from accounts.models import Profile
from accounts.serializers import address_zip
from config.log import get_logger

from .models import ItemPhoto
from .serializers import ItemSerializer, check_photos

logger = get_logger(__name__)


def verified_org(user):
    org = getattr(user, "organization", None)
    return org if org and org.verified_at else None


class IsGiver(BasePermission):
    """A Verified organization, or a person with Give support (or Both) on."""

    message = "Only verified organizations and people with Give support on can post items."

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            return False
        if profile.account_type == Profile.ORGANIZATION:
            return verified_org(request.user) is not None
        return profile.usage in ("give", "both")


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsGiver])
def post_item(request):
    """Saves an item and its photos (Mock Ups 19-20). Sent as multipart form data when it has photos."""
    org = verified_org(request.user)
    if org and not address_zip(org.pickup_address):
        return Response(
            {"detail": "Add your public pickup address to your organization profile first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer = ItemSerializer(data=request.data, context={"organization": org})
    serializer.is_valid(raise_exception=True)
    photos = check_photos(request.FILES.getlist("photos"))
    with transaction.atomic():
        item = serializer.save(owner=request.user)
        ItemPhoto.objects.bulk_create(ItemPhoto(item=item, content_type=t, data=d) for t, d in photos)
    logger.info("item posted user_id=%s item_id=%s photos=%s", request.user.pk, item.pk, len(photos))
    return Response(ItemSerializer(item).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def item_photo(request, pk):
    """Only the giver sees their photos for now: a porch photo can show where someone lives.
    Item details (KAN-17) and the privacy rule (KAN-11) decide who else may."""
    photo = get_object_or_404(ItemPhoto, pk=pk, item__owner=request.user)
    resp = HttpResponse(bytes(photo.data), content_type=photo.content_type)
    resp["Cache-Control"] = "private, max-age=31536000, immutable"  # photos never change
    return resp
