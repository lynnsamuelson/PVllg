from django.db.models import Prefetch
from django.http import HttpResponse
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.views import IsPerson
from items import privacy
from items.models import Item, ItemPhoto

from . import actions, calendar
from .models import Claim
from .giver import RequestSerializer
from .serializers import ClaimSerializer, NewClaimSerializer


def my_claims_queryset(user):
    """The user's claims with each item loaded the way PublicItemSerializer reads it. Not live(): a claim on an item
    that was taken down still shows under Past."""
    items = Item.objects.with_counts().select_related("owner__profile", "owner__organization")
    photo_ids = Prefetch("item__photos", queryset=ItemPhoto.objects.only("pk", "item_id"))
    return Claim.objects.filter(claimant=user).prefetch_related(Prefetch("item", queryset=items), photo_ids)


def context(request):
    """Serializer context with the user's approved claims looked up once for the whole list (privacy rule)."""
    return {"request": request, "approved_item_ids": privacy.approved_item_ids(request.user)}


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsPerson])
def claims(request):
    """GET: My claims (Mock Up 15); ?tab=past for ended claims, otherwise current ones.
    POST {item}: Claim one / Request to claim (Mock Ups 13-14)."""
    actions.expire_overdue()
    if request.method == "GET":
        mine = my_claims_queryset(request.user)
        if request.query_params.get("tab") == "past":
            mine = mine.exclude(status__in=Claim.ACTIVE)
        else:
            mine = mine.filter(status__in=Claim.ACTIVE)
        return Response(ClaimSerializer(mine, many=True, context=context(request)).data)
    body = NewClaimSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    try:
        claim = actions.claim_item(request.user, body.validated_data["item"])
    except actions.ClaimRefused as refused:
        return Response({"detail": str(refused)}, status=refused.code)
    claim = my_claims_queryset(request.user).get(pk=claim.pk)
    return Response(ClaimSerializer(claim, context=context(request)).data, status=status.HTTP_201_CREATED)


def answer(request, pk, action, refusal):
    """The giver of the claimed item answers (KAN-13); nobody else can. Replies with the claim as the giver sees it
    (the family's first name only)."""
    actions.expire_overdue()
    claim = get_object_or_404(Claim.objects.select_related("claimant", "item"), pk=pk, item__owner=request.user)
    if not action(claim):
        return Response({"detail": refusal}, status=status.HTTP_400_BAD_REQUEST)
    return Response(RequestSerializer(claim).data)


@api_view(["POST"])
def approve_claim(request, pk):
    return answer(request, pk, actions.approve_claim, "This request can't be approved anymore.")


@api_view(["POST"])
def decline_claim(request, pk):
    return answer(request, pk, actions.decline_claim, "This request isn't waiting anymore.")


@api_view(["POST"])
def picked_up(request, pk):
    return answer(request, pk, actions.mark_picked_up, "This claim isn't approved.")


@api_view(["POST"])
def didnt_come(request, pk):
    return answer(
        request, pk, actions.family_didnt_come, "You can say the family didn't come once the pickup day has come."
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsPerson])
def claim_detail(request, pk):
    """One of the family's own Approved claims, for Add to calendar (Mock Up 16), with the event's place and notes."""
    actions.expire_overdue()
    claim = get_object_or_404(my_claims_queryset(request.user), pk=pk, status=Claim.APPROVED)
    where, notes = calendar.event_details(claim, request.user)
    return Response({**ClaimSerializer(claim, context=context(request)).data, "event": {"where": where, "notes": notes}})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsPerson])
def claim_calendar(request, pk):
    """The calendar file for an Approved claim (KAN-19); the button is only on Approved cards (Mock Up 15). ?reminders=day,hour adds alarms; ?download=1 saves it as a file
    instead of opening it in the calendar app. Adding it clears the "Pickup details changed" notice."""
    actions.expire_overdue()
    claim = get_object_or_404(
        Claim.objects.select_related("item__owner__profile", "item__owner__organization"),
        pk=pk, claimant=request.user, status=Claim.APPROVED,
    )
    reminders = [r for r in request.query_params.get("reminders", "").split(",") if r in calendar.REMINDERS]
    now = timezone.now()
    resp = HttpResponse(calendar.ics(claim, request.user, reminders, now), content_type="text/calendar; charset=utf-8")
    disposition = "attachment" if request.query_params.get("download") else "inline"
    resp["Content-Disposition"] = f'{disposition}; filename="pvill-pickup-{claim.pk}.ics"'
    Claim.objects.filter(pk=claim.pk).update(calendar_added_at=now)
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsPerson])
def cancel_claim(request, pk):
    """Cancel claim: ends the family's own active claim and puts the item back."""
    actions.expire_overdue()  # a hold that already passed ends as "The hold ended", not as canceled
    claim = get_object_or_404(Claim, pk=pk, claimant=request.user)
    if not actions.end_claim(claim, Claim.CANCELED):
        return Response({"detail": "This claim has already ended."}, status=status.HTTP_400_BAD_REQUEST)
    claim = my_claims_queryset(request.user).get(pk=claim.pk)
    return Response(ClaimSerializer(claim, context=context(request)).data)
