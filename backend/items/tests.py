from datetime import timedelta
from importlib import import_module
from unittest import mock

from django.contrib.auth import get_user_model
from django.apps import apps
from django.contrib.auth.models import AnonymousUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import Organization, Profile
from claims.models import Claim
from resources.models import Resource

from . import demo, privacy
from .models import Item, ItemPhoto, local_today

User = get_user_model()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 20


def tomorrow():
    return (timezone.localdate() + timedelta(days=1)).isoformat()


def item(**overrides):
    body = {
        "name": "Baby clothes bundle, 0-3 mo",
        "category": "clothes",
        "details": "6 pieces, washed, no stains.",
        "quantity": 1,
        "good_condition": True,
        "not_recalled": True,
        "pickup_date": tomorrow(),
        "pickup_start": "17:00",
        "pickup_end": "19:00",
        "general_area": "East Nashville",
        "exact_address": "12 Sample Ave, Nashville, TN 37206",
        "where_to_go": "Front porch. Look for the blue bin.",
        "what_to_bring": "Bring a bag.",
    }
    body.update(overrides)
    return {k: v for k, v in body.items() if v is not None}


def make_person(email="giver@example.com", usage="give"):
    user = User.objects.create_user(username=email, password="x")
    Profile.objects.create(user=user, account_type=Profile.PERSON, usage=usage)
    return user


def make_org(verified=True, address="123 Example St, Nashville, TN 37206"):
    user = User.objects.create_user(username="lead@samplecommunitycloset.org", password="x")
    Profile.objects.create(user=user, account_type=Profile.ORGANIZATION)
    Organization.objects.create(
        user=user, name="Sample Community Closet", website="samplecommunitycloset.org",
        domain="samplecommunitycloset.org", work_email=user.username,
        verified_at=timezone.now() if verified else None, pickup_address=address, zip_code="37206" if address else "",
    )
    return user


class PostItemTests(APITestCase):
    def post(self, user, body, fmt="json"):
        self.client.force_authenticate(user)
        return self.client.post("/api/items/", body, format=fmt)

    def posted(self, user, body, fmt="json"):
        with self.assertLogs("items.views", "INFO"):
            resp = self.post(user, body, fmt)
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.json()

    def assert_field_error(self, field, **overrides):
        resp = self.post(make_person(f"p{User.objects.count()}@example.com"), item(**overrides))
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn(field, resp.json())

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().post("/api/items/", item(), format="json").status_code, 401)

    def test_person_with_give_support_posts(self):
        data = self.posted(make_person(), item())
        saved = Item.objects.get(pk=data["id"])
        self.assertEqual((saved.name, saved.general_area, saved.zip_code), ("Baby clothes bundle, 0-3 mo", "East Nashville", "37206"))
        self.assertEqual(saved.exact_address, "12 Sample Ave, Nashville, TN 37206")
        self.assertNotIn("good_condition", data)

    def test_both_can_post_but_get_only_cannot(self):
        self.posted(make_person("both@example.com", "both"), item())
        self.assertEqual(self.post(make_person("get@example.com", "get"), item()).status_code, 403)

    def test_account_without_profile_cannot_post(self):
        self.assertEqual(self.post(User.objects.create_user(username="old@example.com"), item()).status_code, 403)

    def test_verified_org_uses_its_profile_address(self):
        data = self.posted(make_org(), item(exact_address="somewhere else 37208"))
        self.assertNotIn("exact_address", data)
        saved = Item.objects.get(pk=data["id"])
        self.assertEqual((saved.exact_address, saved.zip_code), ("123 Example St, Nashville, TN 37206", "37206"))

    def test_pending_org_cannot_post(self):
        self.assertEqual(self.post(make_org(verified=False), item()).status_code, 403)

    def test_org_needs_its_profile_address_first(self):
        resp = self.post(make_org(address=""), item())
        self.assertEqual(resp.status_code, 400)
        self.assertIn("organization profile", resp.json()["non_field_errors"][0])

    def test_org_address_without_zip_is_refused(self):
        self.assertEqual(self.post(make_org(address="123 Example St, Nashville"), item()).status_code, 400)

    def test_required_answers(self):
        for field in ("name", "category", "details", "quantity", "pickup_date", "pickup_start", "pickup_end",
                      "general_area", "good_condition", "not_recalled"):
            self.assert_field_error(field, **{field: None})

    def test_person_needs_an_address_with_a_zip(self):
        self.assert_field_error("exact_address", exact_address="")
        self.assert_field_error("exact_address", exact_address="12 Sample Ave, Nashville")

    def test_both_boxes_must_be_checked(self):
        self.assert_field_error("good_condition", good_condition=False)
        self.assert_field_error("not_recalled", not_recalled=False)

    def test_bad_values(self):
        self.assert_field_error("quantity", quantity=0)
        self.assert_field_error("category", category="medicine")
        self.assert_field_error("pickup_end", pickup_end="16:00")
        self.assert_field_error("pickup_date", pickup_date=(timezone.localdate() - timedelta(days=2)).isoformat())

    def test_photos(self):
        files = [SimpleUploadedFile("a.png", PNG), SimpleUploadedFile("b.jpg", JPEG)]
        data = self.posted(make_person(), {**item(), "photos": files}, fmt="multipart")
        self.assertEqual(len(data["photos"]), 2)
        resp = self.client.get(data["photos"][0])
        self.assertEqual((resp.status_code, resp["Content-Type"], resp.content), (200, "image/png", PNG))
        self.assertIn("immutable", resp["Cache-Control"])
        self.assertEqual(APIClient().get(data["photos"][0]).status_code, 401)
        self.client.force_authenticate(make_person("other@example.com", "get"))
        self.assertEqual(self.client.get(data["photos"][0]).status_code, 404)

    def test_photo_limits(self):
        user = make_person()
        five = [SimpleUploadedFile(f"{i}.png", PNG) for i in range(5)]
        self.assertIn("photos", self.post(user, {**item(), "photos": five}, "multipart").json())
        text = [SimpleUploadedFile("notes.txt", b"hello there, not a photo")]
        self.assertIn("photos", self.post(user, {**item(), "photos": text}, "multipart").json())
        with mock.patch("items.serializers.MAX_PHOTO_BYTES", 10):
            big = [SimpleUploadedFile("big.png", PNG)]
            self.assertIn("photos", self.post(user, {**item(), "photos": big}, "multipart").json())
        self.assertFalse(Item.objects.filter(owner=user).exists())

    def test_webp_is_a_photo(self):
        webp = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 10
        data = self.posted(make_person(), {**item(), "photos": [SimpleUploadedFile("c.webp", webp)]}, fmt="multipart")
        self.assertEqual(self.client.get(data["photos"][0])["Content-Type"], "image/webp")

    def test_failed_photo_save_leaves_no_item(self):
        user = make_person()
        with mock.patch.object(ItemPhoto.objects, "bulk_create", side_effect=DatabaseError("boom")), \
                self.assertRaises(DatabaseError), self.assertLogs("django.request", "ERROR"):
            self.post(user, {**item(), "photos": [SimpleUploadedFile("a.png", PNG)]}, "multipart")
        self.assertFalse(Item.objects.filter(owner=user).exists())


class MyItemsTests(APITestCase):
    def setUp(self):
        self.user = make_person()
        self.client.force_authenticate(self.user)
        with self.assertLogs("items.views", "INFO"):
            self.id = self.client.post("/api/items/", item(quantity=2), format="json").json()["id"]

    def test_logged_out_is_401(self):
        client = APIClient()
        self.assertEqual(client.get("/api/items/mine/").status_code, 401)
        self.assertEqual(client.delete(f"/api/items/mine/{self.id}/").status_code, 401)

    def test_after_turning_give_off_can_still_see_and_take_down_but_not_edit(self):
        self.user.profile.usage = "get"
        self.user.profile.save()
        url = f"/api/items/mine/{self.id}/"
        self.assertEqual(len(self.client.get("/api/items/mine/").json()), 1)
        self.assertEqual(self.client.put(url, item(), format="json").status_code, 403)
        with self.assertLogs("items.views", "INFO"):
            self.assertEqual(self.client.delete(url).status_code, 204)

    def test_org_edit_without_profile_address_is_a_400(self):
        org = make_org()
        self.client.force_authenticate(org)
        with self.assertLogs("items.views", "INFO"):
            pk = self.client.post("/api/items/", item(), format="json").json()["id"]
        org.organization.pickup_address = ""
        org.organization.save()
        resp = self.client.put(f"/api/items/mine/{pk}/", item(), format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("organization profile", resp.json()["non_field_errors"][0])

    def test_lists_own_items_with_counts_and_address(self):
        other = make_person("other@example.com")
        self.client.force_authenticate(other)
        with self.assertLogs("items.views", "INFO"):
            self.client.post("/api/items/", item(name="Not mine"), format="json")
        self.client.force_authenticate(self.user)
        data = self.client.get("/api/items/mine/").json()
        self.assertEqual([i["name"] for i in data], ["Baby clothes bundle, 0-3 mo"])
        self.assertEqual((data[0]["left"], data[0]["requested"], data[0]["claimed"]), (2, 0, 0))
        self.assertEqual(data[0]["exact_address"], "12 Sample Ave, Nashville, TN 37206")
        self.assertNotIn("photos", data[0])

    def test_cannot_see_or_change_someone_elses_item(self):
        self.client.force_authenticate(make_person("other@example.com"))
        url = f"/api/items/mine/{self.id}/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.put(url, item(), format="json").status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)

    def test_edit(self):
        url = f"/api/items/mine/{self.id}/"
        self.assertEqual(self.client.get(url).json()["quantity"], 2)
        with self.assertLogs("items.views", "INFO"):
            resp = self.client.put(url, item(quantity=5, details="Now 8 pieces", general_area="Downtown"), format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        saved = Item.objects.get(pk=self.id)
        self.assertEqual((saved.quantity, saved.details, saved.general_area), (5, "Now 8 pieces", "Downtown"))

    def test_edit_is_validated(self):
        resp = self.client.put(f"/api/items/mine/{self.id}/", item(quantity=0), format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Item.objects.get(pk=self.id).quantity, 2)

    def test_take_down(self):
        with self.assertLogs("items.views", "INFO"):
            self.assertEqual(self.client.delete(f"/api/items/mine/{self.id}/").status_code, 204)
        self.assertIsNotNone(Item.objects.get(pk=self.id).taken_down_at)
        self.assertEqual(self.client.get("/api/items/mine/").json(), [])
        self.assertEqual(self.client.get(f"/api/items/mine/{self.id}/").status_code, 404)


class AddressPrivacyTests(APITestCase):
    """KAN-11: who sees a person's exact address, and what everyone else sees."""

    def setUp(self):
        self.giver = make_person()
        self.giver.first_name = "Jordan Lee"
        self.giver.save()
        self.client.force_authenticate(self.giver)
        with self.assertLogs("items.views", "INFO"):
            self.id = self.client.post("/api/items/", item(), format="json").json()["id"]
        self.item = Item.objects.get(pk=self.id)
        self.family = make_person("family@example.com", "get")
        self.family.profile.zip_code = "37208"
        self.family.profile.save()

    def view_as(self, user):
        self.client.force_authenticate(user)
        return self.client.get(f"/api/items/{self.id}/").json()

    def claim(self, status):
        return Claim.objects.create(item=self.item, claimant=self.family, status=status)

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().get(f"/api/items/{self.id}/").status_code, 401)

    def test_others_see_area_rounded_distance_first_name_and_the_note(self):
        data = self.view_as(self.family)
        self.assertIsNone(data["exact_address"])
        self.assertIsNone(data["where_to_go"])
        self.assertEqual(data["private_note"], privacy.PRIVATE_NOTE)
        self.assertEqual(data["general_area"], "East Nashville")
        self.assertEqual(data["giver"], "Jordan")
        self.assertIsInstance(data["distance_miles"], int)
        self.assertGreaterEqual(data["distance_miles"], 1)
        self.assertNotIn("12 Sample Ave", str(data))
        self.assertNotIn("zip_code", data)

    def test_waiting_claim_still_hides_it(self):
        self.claim(Claim.WAITING)
        self.assertIsNone(self.view_as(self.family)["exact_address"])

    def test_approved_claim_shows_it_until_the_claim_ends(self):
        claim = self.claim(Claim.APPROVED)
        data = self.view_as(self.family)
        self.assertEqual(data["exact_address"], "12 Sample Ave, Nashville, TN 37206")
        self.assertEqual(data["where_to_go"], "Front porch. Look for the blue bin.")
        self.assertIsNone(data["private_note"])
        for ended in (Claim.DECLINED, Claim.CANCELED, Claim.ENDED, Claim.PICKED_UP):
            claim.status = ended
            claim.save()
            self.assertIsNone(self.view_as(self.family)["exact_address"], ended)

    def test_approved_claim_on_a_taken_down_item_hides_it(self):
        self.claim(Claim.APPROVED)
        self.item.taken_down_at = timezone.now()
        self.item.save()
        self.assertFalse(privacy.can_see_exact_address(self.family, self.item))

    def test_someone_elses_approval_doesnt_count(self):
        self.claim(Claim.APPROVED)
        stranger = make_person("stranger@example.com", "get")
        self.assertIsNone(self.view_as(stranger)["exact_address"])

    def test_giver_sees_their_own(self):
        self.assertEqual(self.view_as(self.giver)["exact_address"], "12 Sample Ave, Nashville, TN 37206")

    def test_organization_address_is_public(self):
        org = make_org()
        self.client.force_authenticate(org)
        with self.assertLogs("items.views", "INFO"):
            pk = self.client.post("/api/items/", item(), format="json").json()["id"]
        self.client.force_authenticate(self.family)
        data = self.client.get(f"/api/items/{pk}/").json()
        self.assertEqual(data["exact_address"], "123 Example St, Nashville, TN 37206")
        self.assertEqual(data["giver"], "Sample Community Closet")
        self.assertTrue(data["from_organization"])
        self.assertIsNone(data["private_note"])

    def test_unknown_zip_has_no_distance_and_taken_down_items_are_gone(self):
        self.family.profile.zip_code = ""
        self.family.profile.save()
        self.assertIsNone(self.view_as(self.family)["distance_miles"])
        self.item.taken_down_at = timezone.now()
        self.item.save()
        self.client.force_authenticate(self.family)
        self.assertEqual(self.client.get(f"/api/items/{self.id}/").status_code, 404)

    def test_distance_is_whole_miles_and_at_least_one(self):
        self.family.profile.zip_code = "37206"  # same ZIP as the item: 0 miles reads as about 1
        self.family.profile.save()
        self.assertEqual(self.view_as(self.family)["distance_miles"], 1)

    def test_organization_must_be_verified_for_a_public_address(self):
        self.giver.profile.account_type = Profile.ORGANIZATION  # e.g. flipped in admin, no Organization row
        self.giver.profile.save()
        data = self.view_as(self.family)
        self.assertIsNone(data["exact_address"])
        self.assertEqual(data["giver"], "Jordan")

    def test_signed_out_viewer_never_sees_it(self):
        self.assertFalse(privacy.can_see_exact_address(AnonymousUser(), self.item))
        self.assertEqual(privacy.approved_item_ids(AnonymousUser()), set())

    def test_approval_ends_the_day_after_pickup(self):
        self.claim(Claim.APPROVED)
        self.item.pickup_date = local_today() - timedelta(days=1)
        self.item.save()
        self.assertTrue(privacy.can_see_exact_address(self.family, self.item))
        self.item.pickup_date = local_today() - timedelta(days=2)
        self.item.save()
        self.assertFalse(privacy.can_see_exact_address(self.family, self.item))

    def test_half_miles_round_up(self):
        with mock.patch("items.privacy.miles_between", return_value=2.5):
            self.assertEqual(privacy.rounded_miles(self.family, self.item), 3)
        with mock.patch("items.privacy.miles_between", return_value=3.49):
            self.assertEqual(privacy.rounded_miles(self.family, self.item), 3)

    def test_giver_without_a_name(self):
        self.giver.first_name = ""
        self.giver.save()
        self.assertEqual(self.view_as(self.family)["giver"], "A neighbor")


class DemoDataTests(APITestCase):
    """KAN-26: the made-up demo accounts and sample items loaded by migration."""

    def test_demo_accounts_and_items(self):
        closet = User.objects.get(username="team@samplecommunitycloset.example")
        self.assertFalse(closet.has_usable_password())
        self.assertIsNotNone(closet.organization.verified_at)
        self.assertEqual(closet.organization.zip_code, "37206")
        taylor = User.objects.get(username="taylor@demo.example")
        self.assertEqual(taylor.profile.needs, ["essentials", "feeding"])
        self.assertEqual(taylor.profile.usage, "get")
        jordan = User.objects.get(username="jordan@demo.example")
        self.assertEqual(jordan.profile.roles, ["parent", "kinship"])
        demo_items = Item.objects.filter(owner__username__endswith=".example")
        self.assertEqual(demo_items.count(), 10)
        diapers = demo_items.get(name="Size 1 diapers")
        self.assertEqual((diapers.quantity, diapers.zip_code), (12, "37206"))
        self.assertEqual(diapers.exact_address, "100 Sample Way, Nashville, TN 37206")
        # Set when the test database was built, which may have been just before midnight.
        self.assertIn(diapers.pickup_date - local_today(), (timedelta(days=3), timedelta(days=2)))
        self.assertTrue(closet.profile.is_demo and taylor.profile.is_demo)
        self.assertEqual((diapers.pickup_start.hour, diapers.pickup_end.hour), (10, 14))
        bundle = demo_items.get(name="Baby clothes bundle, 0-3 mo")
        self.assertEqual(bundle.owner.first_name, "Casey")
        self.assertEqual((bundle.exact_address, bundle.zip_code), ("400 Fictional St, Nashville, TN 37207", "37207"))

    def test_refresh_dates_moves_only_demo_items(self):
        mine = make_person()
        self.client.force_authenticate(mine)
        with self.assertLogs("items.views", "INFO"):
            own = self.client.post("/api/items/", item(), format="json").json()["id"]
        Item.objects.update(pickup_date="2020-01-01")
        self.assertEqual(demo.refresh_dates(Item.objects.all()), 10)
        self.assertEqual(Item.objects.get(name="Pack and play").pickup_date, local_today() + timedelta(days=5))
        self.assertEqual(str(Item.objects.get(pk=own).pickup_date), "2020-01-01")

    def test_public_items_say_demo(self):
        self.client.force_authenticate(make_person("viewer@example.com", "get"))
        demo_item = Item.objects.get(name="Size 1 diapers")
        self.assertTrue(self.client.get(f"/api/items/{demo_item.pk}/").json()["demo"])

    def test_admin_action(self):
        admin_user = User.objects.create_superuser(username="admin@example.com", password="x")
        self.client.force_login(admin_user)
        Item.objects.update(pickup_date="2020-01-01")
        ids = list(Item.objects.values_list("pk", flat=True))
        resp = self.client.post(
            "/admin/items/item/", {"action": "refresh_demo_dates", "_selected_action": ids}, follow=True
        )
        self.assertContains(resp, "Moved 10 demo item(s)")

    def test_loading_twice_leaves_existing_accounts_alone(self):
        import_module("items.migrations.0003_demo_data").load(apps, None)
        self.assertEqual(Item.objects.filter(owner__username__endswith=".example").count(), 10)

    def test_unload_removes_the_demo_accounts(self):
        migration = import_module("items.migrations.0003_demo_data")
        migration.unload(apps, None)
        self.assertFalse(User.objects.filter(username__endswith=".example").exists())
        self.assertFalse(Item.objects.filter(owner__username__endswith=".example").exists())


class StarterResourceTests(APITestCase):
    def test_twelve_real_resources_with_facts_and_not_listed_blanks(self):
        self.assertEqual(Resource.objects.count(), 12)
        similac = Resource.objects.get(title="MySimilac Rewards")
        self.assertIn("not free formula", similac.summary)
        self.assertEqual(similac.area_type, "national")
        tenncare = Resource.objects.get(title="TennCare Diaper Benefit")
        self.assertEqual((tenncare.age_min_months, tenncare.age_max_months), (0, 23))
        ffan = Resource.objects.get(title="Foster Families Assistance Network (FFAN)")
        self.assertEqual(ffan.serves, ["foster", "kinship", "adoptive"])
        self.assertEqual(ffan.public_phone, "")  # not listed
        grace = Resource.objects.get(title="Grace Place")
        self.assertIn("not an emergency shelter", grace.limits)
        self.assertEqual(str(grace.last_checked), "2026-10-17")
        self.assertFalse(Resource.objects.filter(title="Help center").exists())
