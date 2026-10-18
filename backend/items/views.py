from django.db import transaction
from django.db.models import Prefetch, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from accounts.models import Profile
from accounts.views import IsOrganization
from claims.actions import expire_overdue
from claims.models import Claim
from config.log import get_logger

from . import privacy
from .impact import EXAMPLE, impact
from .models import CATEGORIES, Item, ItemPhoto, ItemReport, local_today
from .serializers import (
    CHIP_CATEGORIES,
    ItemReportSerializer,
    ItemSearchSerializer,
    ItemSerializer,
    OwnItemSerializer,
    PublicItemSerializer,
    check_photos,
)

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
    serializer = ItemSerializer(data=request.data, context={"organization": verified_org(request.user)})
    serializer.is_valid(raise_exception=True)
    photos = check_photos(request.FILES.getlist("photos"))
    with transaction.atomic():
        item = serializer.save(owner=request.user)
        ItemPhoto.objects.bulk_create(ItemPhoto(item=item, content_type=t, data=d) for t, d in photos)
    logger.info("item posted user_id=%s item_id=%s photos=%s", request.user.pk, item.pk, len(photos))
    return Response(ItemSerializer(item).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def search_items(request):
    """Search near me, Items tab (KAN-15): live items with some left and a pickup day that hasn't passed, within
    `radius` miles of the viewer's ZIP, nearest first. Items whose distance can't be worked out aren't shown, so nothing out of range reads as nearby."""
    expire_overdue()
    params = ItemSearchSerializer(data=request.query_params)
    params.is_valid(raise_exception=True)
    opts = params.validated_data
    items = (
        Item.objects.public()
        .filter(left__gt=0, pickup_date__gte=local_today(), paused_at__isnull=True, zip_code__in=privacy.zips_within(request.user, opts["radius"]))
        .exclude(owner=request.user)
    )
    if opts["category"]:
        items = items.filter(category__in=CHIP_CATEGORIES[opts["category"]])
    for word in opts["q"].split():
        labels = [key for key, label in CATEGORIES.items() if word.lower() in label.lower()]
        items = items.filter(Q(name__icontains=word) | Q(details__icontains=word) | Q(category__in=labels))
    nearby = []
    for item in items:
        distance = privacy.miles(request.user, item)  # unrounded, so the radius is a strict cutoff
        if distance is not None and distance <= opts["radius"]:
            nearby.append((distance, item.pickup_date, item))
    nearby.sort(key=lambda m: (m[0], m[1]))
    serializer = PublicItemSerializer([item for _, _, item in nearby], many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsOrganization])
def impact_numbers(request):
    """The Impact tab (Mock Up 10): an organization's last 30 days. `demo` is true for the made-up demo
    organizations, whose numbers the screen labels Example data."""
    expire_overdue()
    profile = request.user.profile
    org = getattr(request.user, "organization", None)
    numbers = EXAMPLE if profile.is_demo else impact(request.user)
    return Response({"organization": org.name if org else request.user.first_name, "demo": profile.is_demo, **numbers})


@api_view(["POST"])
def report_item(request, pk):
    """Report a problem on an item page (Mock Up 24): {reason}. Saved for the PVill team; the item doesn't change."""
    body = ItemReportSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    item = get_object_or_404(Item.objects.live(), pk=pk)
    if item.owner_id == request.user.pk:
        return Response({"detail": "You posted this item."}, status=status.HTTP_400_BAD_REQUEST)
    reason = body.validated_data["reason"]
    ItemReport.objects.get_or_create(item=item, reporter=request.user, reason=reason)  # the same report once
    logger.info("item reported user_id=%s item_id=%s reason=%s", request.user.pk, item.pk, reason)
    return Response(status=status.HTTP_201_CREATED)


@api_view(["GET"])
def item_detail(request, pk):
    """One item as anyone signed in sees it, with the address privacy rule applied (KAN-11; screen in KAN-17)."""
    expire_overdue()
    item = get_object_or_404(Item.objects.public(), pk=pk)
    return Response(PublicItemSerializer(item, context={"request": request}).data)


def own_items():
    """Items with counts and their claims' families loaded, for My items and Edit."""
    claims = Prefetch(
        "claims", queryset=Claim.objects.filter(status__in=Claim.ACTIVE).select_related("claimant").order_by("created_at")
    )
    return Item.objects.live().with_counts().prefetch_related(claims)


# My items only needs a login: someone who turns Give support off can still see and take down what they posted.
@api_view(["GET"])
def my_items(request):
    """My items (Mock Up 21): the giver's items that aren't taken down, newest first."""
    expire_overdue()
    items = own_items().filter(owner=request.user)
    return Response(OwnItemSerializer(items, many=True).data)


@api_view(["GET", "PUT", "DELETE"])
def my_item(request, pk):
    """One of the giver's items: GET fills in Edit, PUT saves it (givers only; photos stay as they are),
    DELETE takes it down."""
    expire_overdue()
    item = get_object_or_404(own_items(), pk=pk, owner=request.user)
    if request.method == "GET":
        return Response(OwnItemSerializer(item).data)
    if request.method == "DELETE":
        item.taken_down_at = timezone.now()
        item.save(update_fields=["taken_down_at"])
        logger.info("item taken down user_id=%s item_id=%s", request.user.pk, item.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)
    if not IsGiver().has_permission(request, None):
        return Response({"detail": IsGiver.message}, status=status.HTTP_403_FORBIDDEN)
    with transaction.atomic():  # lock the item so a claim can't land between checking the count and saving it
        Item.objects.select_for_update().filter(pk=item.pk).first()
        item = Item.objects.with_counts().get(pk=item.pk)
        serializer = OwnItemSerializer(item, data=request.data, context={"organization": verified_org(request.user)})
        serializer.is_valid(raise_exception=True)
        serializer.save()
    logger.info("item edited user_id=%s item_id=%s", request.user.pk, item.pk)
    return Response(OwnItemSerializer(own_items().get(pk=item.pk)).data)  # fresh counts


@api_view(["POST"])
def item_available(request, pk):
    """The giver confirms a paused item is still there (KAN-20, "Yes, it is available"): it shows in search again."""
    item = get_object_or_404(Item.objects.live(), pk=pk, owner=request.user, paused_at__isnull=False)
    Item.objects.filter(pk=item.pk).update(paused_at=None, paused_reason="")
    logger.info("item unpaused user_id=%s item_id=%s", request.user.pk, item.pk)
    return Response(OwnItemSerializer(own_items().get(pk=item.pk)).data)


@api_view(["GET"])
def item_photo(request, pk):
    """A photo of a live item, for anyone signed in (item details, KAN-17 shows them), or any photo for its giver.
    Givers are told on Post an item that photos are public."""
    photo = get_object_or_404(
        ItemPhoto.objects.filter(Q(item__taken_down_at__isnull=True) | Q(item__owner=request.user)), pk=pk
    )
    resp = HttpResponse(bytes(photo.data), content_type=photo.content_type)
    resp["Cache-Control"] = "private, max-age=3600"  # an hour, so a taken-down item's photos stop showing soon
    return resp
