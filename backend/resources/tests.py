from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Resource

User = get_user_model()


class ResourceAccessTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ada@example.com", email="ada@example.com", password="x")

    def test_logged_out_gets_401(self):
        self.assertEqual(self.client.get("/api/resources/").status_code, 401)
        first = Resource.objects.first()
        self.assertEqual(self.client.get(f"/api/resources/{first.id}/").status_code, 401)

    def test_logged_in_sees_seeded_resources(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get("/api/resources/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 4)
        first = resp.json()[0]
        detail = self.client.get(f"/api/resources/{first['id']}/")
        self.assertEqual(detail.json()["title"], first["title"])

    def test_read_only_via_api(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post("/api/resources/", {"title": "x"}, format="json")
        self.assertEqual(resp.status_code, 405)
