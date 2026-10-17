from unittest import mock

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

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
