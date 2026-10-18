from django.contrib.auth import get_user_model
from django.test import TestCase

from items.models import Item

from .models import Claim

User = get_user_model()


class ClaimModelTests(TestCase):
    def test_starts_waiting_and_reads_well(self):
        giver = User.objects.create_user(username="giver@example.com")
        family = User.objects.create_user(username="family@example.com")
        item = Item.objects.create(
            owner=giver, name="Crib", category="furniture", details="x", quantity=1, pickup_date="2030-01-01",
            pickup_start="10:00", pickup_end="11:00", general_area="East Nashville", exact_address="1 A St 37206",
            zip_code="37206",
        )
        claim = Claim.objects.create(item=item, claimant=family)
        self.assertEqual(claim.status, Claim.WAITING)
        self.assertEqual(str(claim), "family@example.com → Crib (waiting)")
