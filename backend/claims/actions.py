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


def end_claim(claim, status):
    """Ends an active claim as declined, canceled or ended, which puts its item back. Returns False if the claim had
    already ended (for example two taps at once), True otherwise."""
    if status not in ENDINGS:
        raise ValueError(f"end_claim can't end a claim as {status!r}")
    ended = Claim.objects.filter(pk=claim.pk, status__in=Claim.ACTIVE).update(status=status)
    if ended:
        claim.status = status
        logger.info("claim ended claim_id=%s status=%s", claim.pk, status)
    return bool(ended)
