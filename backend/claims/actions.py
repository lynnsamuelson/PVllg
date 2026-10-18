"""Claim actions shared by every screen that changes a claim (KAN-12). Cancel claim uses end_claim now; Decline
(KAN-13), missed pickups (KAN-14) and pickup problems (KAN-20) use it too, so a claim always ends the same way."""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from config.log import get_logger
from items import privacy
from items.models import Item, local_today

from .models import Claim

logger = get_logger(__name__)

HOLD = timedelta(days=3)  # proposed in KAN-12; the PO still has to confirm it
ENDINGS = {Claim.DECLINED, Claim.CANCELED, Claim.ENDED}  # each puts the item back for other families


class ClaimRefused(Exception):
    """Why a claim couldn't be made, in words for the family. `code` is the HTTP status to answer with."""

    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def claim_item(user, item_id):
    """Holds one of an item for `user` for 3 days. A Verified organization's item is Approved at once; a person's
    waits for the giver (KAN-13). The item row is locked so two families can't both get the last one."""
    with transaction.atomic():
        item = Item.objects.select_for_update().filter(pk=item_id).live().first()
        if item is None or item.pickup_date < local_today():
            raise ClaimRefused("This item isn't available anymore.", 404)
        if item.owner_id == user.pk:
            raise ClaimRefused("You posted this item, so you can't claim it.")
        if Claim.objects.filter(item=item, claimant=user, status__in=Claim.ACTIVE).exists():
            raise ClaimRefused("You already have a claim on this item. See My claims.")
        if Item.objects.with_counts().get(pk=item.pk).left <= 0:
            raise ClaimRefused("Someone just claimed the last one. Try searching for another.", 409)
        claim = Claim.objects.create(
            item=item,
            claimant=user,
            status=Claim.APPROVED if privacy.from_organization(item) else Claim.WAITING,
            held_until=timezone.now() + HOLD,
        )
    logger.info("claim made user_id=%s item_id=%s claim_id=%s status=%s", user.pk, item.pk, claim.pk, claim.status)
    return claim


def approve_claim(claim):
    """The giver says yes (KAN-13): a Waiting claim becomes Approved, which shows the family the exact place.
    Returns False if the claim wasn't Waiting anymore (for example the family canceled first) or its item can't be
    picked up anymore (taken down, or its pickup day has passed)."""
    live = Item.objects.live().filter(pk=claim.item_id, pickup_date__gte=local_today())
    if not live.exists():
        return False
    approved = Claim.objects.filter(pk=claim.pk, status=Claim.WAITING).update(status=Claim.APPROVED)
    if approved:
        claim.status = Claim.APPROVED
        logger.info("claim approved claim_id=%s", claim.pk)
    return bool(approved)


def mark_picked_up(claim):
    """The giver confirms the family came (KAN-13): an Approved claim is done and its item counts as picked up.
    Returns False if the claim wasn't Approved."""
    done = Claim.objects.filter(pk=claim.pk, status=Claim.APPROVED).update(status=Claim.PICKED_UP)
    if done:
        claim.status = Claim.PICKED_UP
        logger.info("claim picked up claim_id=%s", claim.pk)
    return bool(done)


def decline_claim(claim):
    """The giver says no (KAN-13): ends a Waiting request as Declined. An Approved claim can't be declined."""
    return end_claim(claim, Claim.DECLINED, only_from=[Claim.WAITING])


def end_claim(claim, status, only_from=Claim.ACTIVE):
    """Ends a claim that is in one of `only_from` as declined, canceled or ended, which puts its item back. Returns
    False if the claim wasn't (for example it already ended, or two taps at once), True otherwise."""
    if status not in ENDINGS:
        raise ValueError(f"end_claim can't end a claim as {status!r}")
    ended = Claim.objects.filter(pk=claim.pk, status__in=only_from).update(status=status)
    if ended:
        claim.status = status
        logger.info("claim ended claim_id=%s status=%s", claim.pk, status)
    return bool(ended)
