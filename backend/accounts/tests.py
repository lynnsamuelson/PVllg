import os
import re
import smtplib
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from items.models import Item

from .models import Organization, Profile

User = get_user_model()
GOOD_PASSWORD = "correct-horse-battery-42"


class SignupTests(APITestCase):
    def test_signup_creates_user_and_logs_in(self):
        with self.assertLogs("accounts.views", "INFO") as logs:
            resp = self.client.post(
                "/api/auth/signup/",
                {"name": "Ada", "email": "Ada@Example.com", "password": GOOD_PASSWORD, "account_type": "person"},
                format="json",
            )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("signup user_id=", logs.output[0])
        self.assertEqual(resp.json()["user"]["email"], "ada@example.com")
        self.assertEqual(self.client.get("/api/auth/me/").json()["user"]["name"], "Ada")
        self.assertTrue(User.objects.get(username="ada@example.com").check_password(GOOD_PASSWORD))
        self.assertEqual(resp.json()["user"]["account_type"], "person")

    def test_signup_as_organization(self):
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.client.post(
                "/api/auth/signup/",
                {"name": "Food Bank", "email": "hi@foodbank.org", "password": GOOD_PASSWORD, "account_type": "organization"},
                format="json",
            )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(self.client.get("/api/auth/me/").json()["user"]["account_type"], "organization")
        self.assertEqual(User.objects.get(username="hi@foodbank.org").profile.account_type, "organization")

    def test_failed_profile_save_leaves_no_account(self):
        with mock.patch("accounts.serializers.Profile.objects.create", side_effect=RuntimeError("db down")):
            with self.assertRaises(RuntimeError), self.assertLogs("django.request", "ERROR"):
                self.client.post(
                    "/api/auth/signup/",
                    {"name": "Ada", "email": "ada@example.com", "password": GOOD_PASSWORD, "account_type": "person"},
                    format="json",
                )
        self.assertFalse(User.objects.exists())

    def test_account_type_required_and_checked(self):
        for extra in ({}, {"account_type": "robot"}):
            resp = self.client.post(
                "/api/auth/signup/",
                {"name": "Ada", "email": "ada@example.com", "password": GOOD_PASSWORD, **extra},
                format="json",
            )
            self.assertEqual(resp.status_code, 400)
            self.assertIn("account_type", resp.json())
        self.assertFalse(User.objects.exists())

    def test_duplicate_email_rejected_case_insensitively(self):
        User.objects.create_user(username="ada@example.com", email="ada@example.com", password=GOOD_PASSWORD)
        resp = self.client.post(
            "/api/auth/signup/",
            {"name": "Ada", "email": "ADA@example.com", "password": GOOD_PASSWORD, "account_type": "person"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.json())

    def test_weak_password_rejected(self):
        resp = self.client.post(
            "/api/auth/signup/",
            {"name": "Ada", "email": "ada@example.com", "password": "password", "account_type": "person"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("password", resp.json())


class LoginTests(APITestCase):
    def setUp(self):
        User.objects.create_user(
            username="ada@example.com", email="ada@example.com", password=GOOD_PASSWORD, first_name="Ada"
        )

    def test_login_logout_flow(self):
        self.assertIsNone(self.client.get("/api/auth/me/").json()["user"])
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.client.post(
                "/api/auth/login/", {"email": "ADA@example.com", "password": GOOD_PASSWORD}, format="json"
            )
        self.assertEqual(resp.status_code, 200)
        me = self.client.get("/api/auth/me/").json()["user"]
        self.assertEqual(me["email"], "ada@example.com")
        self.assertEqual(me["account_type"], "person")  # older accounts have no Profile
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertIsNone(self.client.get("/api/auth/me/").json()["user"])

    def test_wrong_password(self):
        with self.assertLogs("accounts.views", "WARNING") as logs:
            resp = self.client.post("/api/auth/login/", {"email": "ada@example.com", "password": "nope"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("login failed email=ada@example.com", logs.output[0])
        self.assertEqual(resp.json()["detail"], "Incorrect email or password.")


class CsrfTests(APITestCase):
    def test_writes_require_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        resp = client.post(
            "/api/auth/signup/",
            {"name": "Ada", "email": "ada@example.com", "password": GOOD_PASSWORD, "account_type": "person"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

        client.get("/api/auth/csrf/")
        token = client.cookies["csrftoken"].value
        with self.assertLogs("accounts.views", "INFO"):
            resp = client.post(
                "/api/auth/signup/",
                {"name": "Ada", "email": "ada@example.com", "password": GOOD_PASSWORD, "account_type": "person"},
                format="json",
                HTTP_X_CSRFTOKEN=token,
            )
        self.assertEqual(resp.status_code, 201)


ORG = {"name": "Sample Community Closet", "website": "samplecommunitycloset.org", "work_email": "hi@samplecommunitycloset.org"}


class OrganizationVerificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lead@example.com", password=GOOD_PASSWORD)
        Profile.objects.create(user=self.user, account_type=Profile.ORGANIZATION)
        self.client.force_authenticate(self.user)

    def start(self, **overrides):
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.client.post("/api/auth/org/", {**ORG, **overrides}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def verify(self, code):
        return self.client.post("/api/auth/org/verify/", {"code": code}, format="json")

    def wrong(self, code):
        return "000000" if code != "000000" else "111111"

    def org(self):
        return Organization.objects.get(user=self.user)

    def test_person_accounts_are_refused(self):
        person = User.objects.create_user(username="ada@example.com", password=GOOD_PASSWORD)
        self.client.force_authenticate(person)
        for url, body in (("/api/auth/org/", ORG), ("/api/auth/org/resend/", {}), ("/api/auth/org/verify/", {"code": "123456"})):
            self.assertEqual(self.client.post(url, body, format="json").status_code, 403, url)

    def test_sends_code_and_starts_pending(self):
        code = self.start(website="https://www.SampleCommunityCloset.org/about", work_email="Hi@SampleCommunityCloset.org")
        self.assertEqual(mail.outbox[0].to, ["hi@samplecommunitycloset.org"])
        self.assertNotIn(code, self.org().code_hash)
        self.assertEqual(self.org().domain, "samplecommunitycloset.org")
        self.assertEqual(str(self.org()), "Sample Community Closet (pending)")
        self.assertNotIn("Sample Community Closet", mail.outbox[0].body)  # typed text never goes into the email
        org = self.client.get("/api/auth/me/").json()["user"]["organization"]
        self.assertEqual(org["status"], "pending")
        self.assertEqual(org["work_email"], "hi@samplecommunitycloset.org")

    def test_email_must_match_website(self):
        resp = self.client.post("/api/auth/org/", {**ORG, "work_email": "hi@othersite.org"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["work_email"], ["Your email must end with @samplecommunitycloset.org."])
        self.assertFalse(Organization.objects.exists())
        self.assertEqual(mail.outbox, [])

    def test_free_email_rejected(self):
        for website, email in (
            ("samplecommunitycloset.org", "closet@gmail.com"),
            ("gmail.com", "closet@gmail.com"),
            ("protonmail.com", "closet@protonmail.com"),
            ("yahoo.co.uk", "closet@yahoo.co.uk"),
            ("gmx.de", "closet@gmx.de"),
        ):
            resp = self.client.post("/api/auth/org/", {**ORG, "website": website, "work_email": email}, format="json")
            self.assertEqual(resp.status_code, 400)
            self.assertEqual(resp.json()["work_email"], ["Free email, like Gmail, can't be used to post items."])

    def test_website_needs_a_domain(self):
        resp = self.client.post("/api/auth/org/", {**ORG, "website": "closet"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("website", resp.json())

    def test_right_code_verifies(self):
        code = self.start()
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.verify(code)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["user"]["organization"]["status"], "verified")
        self.assertEqual(self.org().code_hash, "")
        self.assertEqual(self.verify(code).status_code, 200)  # verifying again is harmless

    def test_wrong_code_stays_pending(self):
        code = self.start()
        with self.assertLogs("accounts.views", "WARNING"):
            resp = self.verify(self.wrong(code))
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], ["That code isn't right. Try again."])
        self.assertEqual(self.org().status, "pending")
        self.assertEqual(self.verify("12ab").json()["code"], ["Enter the 6-digit code."])

    def test_expired_code_rejected(self):
        code = self.start()
        Organization.objects.update(code_expires_at=timezone.now() - timedelta(seconds=1))
        resp = self.verify(code)
        self.assertEqual(resp.json()["code"], ["That code has expired. Send a new code."])
        self.assertEqual(self.org().status, "pending")

    def test_too_many_wrong_tries_kill_the_code(self):
        code = self.start()
        with self.assertLogs("accounts.views", "WARNING"):
            for _ in range(5):
                self.verify(self.wrong(code))
        self.assertEqual(self.verify(code).json()["code"], ["That code has expired. Send a new code."])
        self.assertEqual(self.org().status, "pending")

    def test_new_code_replaces_old(self):
        old = self.start()
        Organization.objects.update(code_sent_at=timezone.now() - timedelta(minutes=1), code_attempts=3)
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.client.post("/api/auth/org/resend/")
        self.assertEqual(resp.status_code, 200)
        new = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        self.assertEqual(self.org().code_attempts, 0)
        if old != new:
            with self.assertLogs("accounts.views", "WARNING"):
                self.assertEqual(self.verify(old).status_code, 400)
        with self.assertLogs("accounts.views", "INFO"):
            self.assertEqual(self.verify(new).status_code, 200)

    def test_resend_cooldown(self):
        self.start()
        self.assertEqual(self.client.post("/api/auth/org/resend/").status_code, 429)
        self.assertEqual(self.client.post("/api/auth/org/", ORG, format="json").status_code, 429)
        self.assertEqual(len(mail.outbox), 1)

    def test_resend_and_verify_need_details_first(self):
        self.assertEqual(self.client.post("/api/auth/org/resend/").status_code, 400)
        self.assertEqual(self.verify("123456").status_code, 400)

    def test_verified_org_cannot_restart(self):
        code = self.start()
        with self.assertLogs("accounts.views", "INFO"):
            self.verify(code)
        self.assertEqual(self.client.post("/api/auth/org/", ORG, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/org/resend/").status_code, 400)

    def test_failed_send_saves_nothing(self):
        with mock.patch("accounts.views.send_mail", side_effect=smtplib.SMTPException("down")):
            with self.assertLogs("accounts.views", "ERROR"), self.assertLogs("django.request", "ERROR"):
                resp = self.client.post("/api/auth/org/", ORG, format="json")
        self.assertEqual(resp.status_code, 503)
        self.assertFalse(Organization.objects.exists())

    def test_failed_resend_keeps_old_code(self):
        code = self.start()
        Organization.objects.update(code_sent_at=timezone.now() - timedelta(minutes=1))
        with mock.patch("accounts.views.send_mail", side_effect=smtplib.SMTPException("down")):
            with self.assertLogs("accounts.views", "ERROR"), self.assertLogs("django.request", "ERROR"):
                self.assertEqual(self.client.post("/api/auth/org/resend/").status_code, 503)
        with self.assertLogs("accounts.views", "INFO"):
            self.assertEqual(self.verify(code).status_code, 200)

    def test_people_have_no_organization(self):
        person = User.objects.create_user(username="ada@example.com", password=GOOD_PASSWORD)
        self.client.force_authenticate(person)
        self.assertIsNone(self.client.get("/api/auth/me/").json()["user"]["organization"])

    def test_daily_send_cap(self):
        self.start()
        for _ in range(4):
            Organization.objects.update(code_sent_at=timezone.now() - timedelta(minutes=1))
            with self.assertLogs("accounts.views", "INFO"):
                self.assertEqual(self.client.post("/api/auth/org/resend/").status_code, 200)
        Organization.objects.update(code_sent_at=timezone.now() - timedelta(minutes=1))
        resp = self.client.post("/api/auth/org/resend/")
        self.assertEqual(resp.status_code, 429)
        self.assertEqual(resp.json()["detail"], "You've asked for a lot of codes today. Try again tomorrow.")
        self.assertEqual(len(mail.outbox), 5)

        Organization.objects.update(send_window_start=timezone.now() - timedelta(days=1, seconds=1))
        with self.assertLogs("accounts.views", "INFO"):
            self.assertEqual(self.client.post("/api/auth/org/resend/").status_code, 200)
        self.assertEqual(self.org().send_count, 1)

    def test_send_that_lost_a_race_sends_nothing(self):
        self.start()
        org = self.org()
        org.code_sent_at = timezone.now() - timedelta(minutes=5)  # what a slower request read before the first send
        from .views import send_code

        self.assertEqual(send_code(org).status_code, 429)
        self.assertEqual(len(mail.outbox), 1)

    def test_code_replaced_while_verifying_counts_as_old(self):
        code = self.start()

        def new_code_arrives_then_match(a, b):
            Organization.objects.update(code_hash="replaced by a resend")
            return True

        with mock.patch("accounts.views.hmac.compare_digest", side_effect=new_code_arrives_then_match):
            resp = self.verify(code)
        self.assertEqual(resp.json()["code"], ["That code has expired. Send a new code."])
        self.assertEqual(self.org().status, "pending")

    def test_old_code_stops_working_while_new_details_are_sent(self):
        old = self.start(name="Attacker", website="attacker.org", work_email="me@attacker.org")
        Organization.objects.update(code_sent_at=timezone.now() - timedelta(minutes=1))

        def verify_old_code_mid_send(*args, **kwargs):
            # A /verify with the old code arriving while the email for the new details is still being sent.
            self.verify_result = self.verify(old)

        victim = {"name": "Victim Food Bank", "website": "victimfoodbank.org", "work_email": "x@victimfoodbank.org"}
        with mock.patch("accounts.views.send_mail", side_effect=verify_old_code_mid_send):
            with self.assertLogs("accounts.views", "INFO"):
                self.assertEqual(self.client.post("/api/auth/org/", victim, format="json").status_code, 200)
        self.assertEqual(self.verify_result.json()["code"], ["That code has expired. Send a new code."])
        org = self.org()
        self.assertEqual((org.domain, org.status), ("victimfoodbank.org", "pending"))


ANSWERS = {
    "zip": "37206",
    "stage": "both",
    "arrival_month": "2027-03",
    "ages": ["3_12mo", "1_2yrs"],
    "roles": ["parent", "kinship"],
    "needs": ["essentials", "feeding"],
    "usage": "both",
}


class PersonProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ada@example.com", password=GOOD_PASSWORD)
        Profile.objects.create(user=self.user, account_type=Profile.PERSON)
        self.client.force_authenticate(self.user)

    def save(self, **overrides):
        body = {**ANSWERS, **overrides}
        body = {k: v for k, v in body.items() if v is not None}
        return self.client.post("/api/auth/profile/", body, format="json")

    def assert_field_error(self, field, **overrides):
        resp = self.save(**overrides)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn(field, resp.json())

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().post("/api/auth/profile/", ANSWERS, format="json").status_code, 401)

    def test_organizations_are_refused(self):
        org = User.objects.create_user(username="lead@example.com", password=GOOD_PASSWORD)
        Profile.objects.create(user=org, account_type=Profile.ORGANIZATION)
        self.client.force_authenticate(org)
        self.assertEqual(self.save().status_code, 403)

    def test_profile_is_null_before_setup(self):
        user = self.client.get("/api/auth/me/").json()["user"]
        self.assertIsNone(user["profile"])
        self.assertFalse(user["gives"])

    def test_saves_answers_and_keeps_them_after_signing_in_again(self):
        with self.assertLogs("accounts.views", "INFO") as logs:
            resp = self.save()
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("profile saved user_id=", logs.output[0])
        self.assertEqual(resp.json()["user"]["profile"], ANSWERS)
        self.assertTrue(resp.json()["user"]["gives"])

        client = APIClient()
        with self.assertLogs("accounts.views", "INFO"):
            client.post("/api/auth/login/", {"email": "ada@example.com", "password": GOOD_PASSWORD}, format="json")
        self.assertEqual(client.get("/api/auth/me/").json()["user"]["profile"], ANSWERS)

    def test_get_support_only_does_not_give(self):
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.save(usage="get")
        self.assertFalse(resp.json()["user"]["gives"])

    def test_parenting_drops_arrival_month(self):
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.save(stage="parenting")
        self.assertEqual(resp.json()["user"]["profile"]["arrival_month"], "")

    def test_expecting_needs_no_children_or_roles(self):
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.save(stage="expecting", ages=[], roles=None)
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["user"]["profile"]["roles"], [])

    def test_older_account_without_profile_gets_one(self):
        user = User.objects.create_user(username="old@example.com", password=GOOD_PASSWORD)
        self.client.force_authenticate(user)
        with self.assertLogs("accounts.views", "INFO"):
            self.assertEqual(self.save().status_code, 200)
        self.assertEqual(Profile.objects.get(user=user).account_type, Profile.PERSON)

    def test_required_answers(self):
        self.assert_field_error("zip", zip=None)
        self.assert_field_error("stage", stage=None)
        self.assert_field_error("needs", needs=[])
        self.assert_field_error("needs", needs=None)
        self.assert_field_error("usage", usage=None)
        self.assert_field_error("ages", stage="parenting", ages=[])
        self.assert_field_error("ages", stage="both", ages=None)

    def test_rejects_bad_values(self):
        self.assert_field_error("zip", zip="3720")
        self.assert_field_error("zip", zip="37206-1234")
        self.assert_field_error("arrival_month", arrival_month="2027-13")
        self.assert_field_error("ages", ages=["newborn"])
        self.assert_field_error("roles", roles=["custodian"])
        self.assert_field_error("needs", needs=["medical"])
        self.assert_field_error("usage", usage="sell")

    def test_prefer_not_to_say_cannot_be_mixed(self):
        self.assert_field_error("roles", roles=["prefer_not", "parent"])
        with self.assertLogs("accounts.views", "INFO"):
            self.assertEqual(self.save(roles=["prefer_not"]).status_code, 200)

    def test_failed_save_leaves_nothing_behind(self):
        user = User.objects.create_user(username="old@example.com", password=GOOD_PASSWORD)
        self.client.force_authenticate(user)
        with mock.patch.object(Profile, "save", side_effect=DatabaseError("boom")), self.assertRaises(DatabaseError), \
                self.assertLogs("django.request", "ERROR"):
            self.save()
        self.assertFalse(Profile.objects.filter(user=user).exists())


ORG_PROFILE = {
    "about": "We share diapers and baby clothes with families in Davidson County.",
    "serves": ["foster", "parents"],
    "pickup_address": "123 Example St, Nashville, TN 37206",
    "public_contact": "info@samplecommunitycloset.org",
}


class OrganizationProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lead@samplecommunitycloset.org", password=GOOD_PASSWORD)
        Profile.objects.create(user=self.user, account_type=Profile.ORGANIZATION)
        self.org = Organization.objects.create(
            user=self.user,
            name="Sample Community Closet",
            website="samplecommunitycloset.org",
            domain="samplecommunitycloset.org",
            work_email="lead@samplecommunitycloset.org",
            verified_at=timezone.now(),
        )
        self.client.force_authenticate(self.user)

    def save(self, **overrides):
        return self.client.post("/api/auth/org/profile/", {**ORG_PROFILE, **overrides}, format="json")

    def assert_field_error(self, field, **overrides):
        resp = self.save(**overrides)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn(field, resp.json())

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().post("/api/auth/org/profile/", ORG_PROFILE, format="json").status_code, 401)

    def test_people_are_refused(self):
        person = User.objects.create_user(username="ada@example.com", password=GOOD_PASSWORD)
        self.client.force_authenticate(person)
        self.assertEqual(self.save().status_code, 403)

    def test_pending_or_unstarted_organizations_are_refused(self):
        self.org.verified_at = None
        self.org.save()
        self.assertEqual(self.save().status_code, 403)
        self.org.delete()
        self.assertEqual(self.save().status_code, 403)

    def test_saves_and_returns_the_profile(self):
        with self.assertLogs("accounts.views", "INFO"):
            resp = self.save()
        self.assertEqual(resp.status_code, 200, resp.content)
        org = resp.json()["user"]["organization"]
        self.assertEqual(org["about"], ORG_PROFILE["about"])
        self.assertEqual(org["serves"], ["parents", "foster"])
        self.assertEqual(org["pickup_address"], ORG_PROFILE["pickup_address"])
        self.assertEqual(org["public_contact"], ORG_PROFILE["public_contact"])
        self.org.refresh_from_db()
        self.assertEqual(self.org.zip_code, "37206")

    def test_can_change_it_later(self):
        with self.assertLogs("accounts.views", "INFO"):
            self.save()
            resp = self.save(about="", serves=[], pickup_address="9 Sample Ave, Nashville 37208-1234",
                             public_contact="+1 (615) 555-0100")
        org = resp.json()["user"]["organization"]
        self.assertEqual((org["about"], org["serves"], org["public_contact"]), ("", [], "+1 (615) 555-0100"))
        self.org.refresh_from_db()
        self.assertEqual(self.org.zip_code, "37208")

    def test_items_follow_a_new_address(self):
        Item.objects.create(
            owner=self.user, name="Crib", category="furniture", details="x", quantity=1,
            pickup_date="2030-01-01", pickup_start="10:00", pickup_end="11:00", general_area="East Nashville",
            exact_address="old 37206", zip_code="37206",
        )
        with self.assertLogs("accounts.views", "INFO"):
            self.save(pickup_address="9 Sample Ave, Nashville, TN 37208")
        self.assertEqual(
            Item.objects.values_list("exact_address", "zip_code").get(), ("9 Sample Ave, Nashville, TN 37208", "37208")
        )

    def test_failed_item_update_keeps_the_old_address(self):
        with mock.patch("django.db.models.QuerySet.update", side_effect=DatabaseError("boom")), \
                self.assertRaises(DatabaseError), self.assertLogs("django.request", "ERROR"):
            self.save()
        self.org.refresh_from_db()
        self.assertEqual(self.org.pickup_address, "")

    def test_address_and_contact_required(self):
        self.assert_field_error("pickup_address", pickup_address="")
        self.assert_field_error("public_contact", public_contact="")

    def test_address_needs_a_zip(self):
        self.assert_field_error("pickup_address", pickup_address="123 Example St, Nashville")
        self.assert_field_error("pickup_address", pickup_address="12345 Main St, Nashville, TN")
        self.assert_field_error("pickup_address", pickup_address="1 Main St, Nashville \u0663\u0667\u0662\u0660\u0666")

    def test_leaving_fields_out_keeps_them(self):
        with self.assertLogs("accounts.views", "INFO"):
            self.save()
            resp = self.client.post("/api/auth/org/profile/", {
                "pickup_address": "9 Sample Ave, Nashville, TN 37208", "public_contact": ORG_PROFILE["public_contact"],
            }, format="json")
        org = resp.json()["user"]["organization"]
        self.assertEqual((org["about"], org["serves"]), (ORG_PROFILE["about"], ["parents", "foster"]))

    def test_contact_must_be_email_or_phone(self):
        self.assert_field_error("public_contact", public_contact="call us")
        self.assert_field_error("public_contact", public_contact="info@")
        self.assert_field_error("public_contact", public_contact="555-0100")
        self.assert_field_error("public_contact", public_contact="call 6155550100 after 5pm")

    def test_only_the_three_groups(self):
        self.assert_field_error("serves", serves=["adoptive"])

    def test_about_is_short(self):
        self.assert_field_error("about", about="x" * 501)


class EnsureAdminTests(APITestCase):
    def run_it(self, **env):
        with mock.patch.dict(os.environ, env):
            call_command("ensure_admin", stdout=mock.Mock())

    def test_creates_admin_then_resets_its_password(self):
        self.run_it(ADMIN_EMAIL=" Owner@Example.com ", ADMIN_PASSWORD=GOOD_PASSWORD)
        admin = User.objects.get(username="owner@example.com")
        self.assertTrue(admin.is_superuser and admin.is_staff)
        admin.is_superuser = admin.is_staff = False
        admin.save()
        self.run_it(ADMIN_EMAIL="owner@example.com", ADMIN_PASSWORD="a-different-password-9")
        admin.refresh_from_db()
        self.assertTrue(admin.check_password("a-different-password-9"))
        self.assertTrue(admin.is_superuser and admin.is_staff)
        self.assertEqual(User.objects.count(), 1)

    def test_skips_without_settings(self):
        self.run_it(ADMIN_EMAIL="owner@example.com", ADMIN_PASSWORD="")
        self.assertFalse(User.objects.exists())


class OrganizationAdminTests(APITestCase):
    def test_reset_removes_the_organization(self):
        admin = User.objects.create_superuser("admin@example.com", "admin@example.com", GOOD_PASSWORD)
        org_user = User.objects.create_user("org@garden.org", "org@garden.org", GOOD_PASSWORD)
        org = Organization.objects.create(user=org_user, name="Garden", website="garden.org", domain="garden.org", work_email="info@garden.org")
        self.client.force_login(admin)
        resp = self.client.post(
            "/admin/accounts/organization/", {"action": "reset_email_check", "_selected_action": [org.pk]}, follow=True
        )
        self.assertContains(resp, "Reset 1 organization(s).")
        self.assertFalse(Organization.objects.filter(pk=org.pk).exists())

    def test_mark_verified_skips_the_code(self):
        admin = User.objects.create_superuser("admin@example.com", "admin@example.com", GOOD_PASSWORD)
        org_user = User.objects.create_user("org@garden.org", "org@garden.org", GOOD_PASSWORD)
        org = Organization.objects.create(
            user=org_user, name="Garden", website="garden.org", domain="garden.org", work_email="info@garden.org", code_hash="x"
        )
        self.client.force_login(admin)
        resp = self.client.post(
            "/admin/accounts/organization/", {"action": "mark_verified", "_selected_action": [org.pk]}, follow=True
        )
        self.assertContains(resp, "Marked 1 organization(s) verified.")
        org.refresh_from_db()
        self.assertEqual(org.status, "verified")
        self.assertEqual(org.code_hash, "")
