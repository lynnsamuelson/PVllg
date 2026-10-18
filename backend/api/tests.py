from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class HealthTests(APITestCase):
    def test_health_is_public(self):
        resp = self.client.get("/api/health/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")


class LockdownTests(APITestCase):
    """Everything except the explicitly public endpoints must require login."""

    PUBLIC = ["/api/health/", "/api/auth/csrf/", "/api/auth/me/"]

    PROTECTED = [
        "/api/notes/",
        "/api/resources/",
        "/api/auth/profile/",
        "/api/auth/org/",
        "/api/auth/org/resend/",
        "/api/auth/org/verify/",
        "/api/resources/matches/",
    ]
    
    def test_public_endpoints_open(self):
        for url in self.PUBLIC:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_protected_endpoints_return_401_when_logged_out(self):
        for url in self.PROTECTED:
            self.assertEqual(self.client.get(url).status_code, 401, url)


class NoteTests(APITestCase):
    def test_create_and_list_when_logged_in(self):
        self.client.force_authenticate(User.objects.create_user(username="a@example.com", password="x"))
        resp = self.client.post("/api/notes/", {"title": "hello", "body": "world"}, format="json")
        self.assertEqual(resp.status_code, 201)
        resp = self.client.get("/api/notes/")
        self.assertEqual(resp.json()[0]["title"], "hello")
