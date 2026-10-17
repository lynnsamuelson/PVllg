from rest_framework.test import APITestCase


class HealthTests(APITestCase):
    def test_health_ok(self):
        resp = self.client.get("/api/health/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")


class NoteTests(APITestCase):
    def test_create_and_list(self):
        resp = self.client.post("/api/notes/", {"title": "hello", "body": "world"}, format="json")
        self.assertEqual(resp.status_code, 201)
        resp = self.client.get("/api/notes/")
        self.assertEqual(resp.json()[0]["title"], "hello")
