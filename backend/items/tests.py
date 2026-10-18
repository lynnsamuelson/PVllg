from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import Organization, Profile

from .models import Item, ItemPhoto

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
        saved = Item.objects.get()
        self.assertEqual((saved.exact_address, saved.zip_code), ("123 Example St, Nashville, TN 37206", "37206"))

    def test_pending_org_cannot_post(self):
        self.assertEqual(self.post(make_org(verified=False), item()).status_code, 403)

    def test_org_needs_its_profile_address_first(self):
        resp = self.post(make_org(address=""), item())
        self.assertEqual(resp.status_code, 400)
        self.assertIn("organization profile", resp.json()["detail"])

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
        self.assertFalse(Item.objects.exists())

    def test_webp_is_a_photo(self):
        webp = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 10
        data = self.posted(make_person(), {**item(), "photos": [SimpleUploadedFile("c.webp", webp)]}, fmt="multipart")
        self.assertEqual(self.client.get(data["photos"][0])["Content-Type"], "image/webp")

    def test_failed_photo_save_leaves_no_item(self):
        user = make_person()
        with mock.patch.object(ItemPhoto.objects, "bulk_create", side_effect=DatabaseError("boom")), \
                self.assertRaises(DatabaseError), self.assertLogs("django.request", "ERROR"):
            self.post(user, {**item(), "photos": [SimpleUploadedFile("a.png", PNG)]}, "multipart")
        self.assertFalse(Item.objects.exists())
