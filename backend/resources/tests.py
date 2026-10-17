from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from .matching import match_resources, miles_between
from .models import Resource

User = get_user_model()


class ResourceAccessTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ada@example.com", email="ada@example.com", password="x")

    def test_logged_out_gets_401(self):
        self.assertEqual(self.client.get("/api/resources/").status_code, 401)
        first = Resource.objects.first()
        self.assertEqual(self.client.get(f"/api/resources/{first.id}/").status_code, 401)
        self.assertEqual(self.client.get("/api/resources/matches/?zip=37206").status_code, 401)

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


def make(title, categories, area_type="local", zip_code="", **tags):
    return Resource.objects.create(
        title=title, category=categories[0], summary=f"{title} summary", categories=categories,
        area_type=area_type, zip_code=zip_code, **tags,
    )


class MatchesEndpointTests(APITestCase):
    """Test resources shaped like the KAN-26 starter list."""

    def setUp(self):
        Resource.objects.all().delete()  # drop the placeholder seed rows
        make("Downtown Diapers", ["essentials"], zip_code="37201")
        make("Statewide Diapers", ["essentials"], "statewide", age_min_months=0, age_max_months=23,
             limits="Children under 2")
        make("Foster Closet", ["essentials"], zip_code="37201", serves=["foster", "kinship", "adoptive"])
        make("County WIC", ["feeding"], zip_code="37201", age_min_months=-9, age_max_months=59)
        make("National Formula Savings", ["feeding"], "national")
        make("Downtown Housing", ["housing"], zip_code="37201")
        make("Hendersonville Housing", ["housing"], zip_code="37075")
        make("Cincinnati Diapers", ["essentials"], zip_code="45202")
        self.client.force_authenticate(User.objects.create_user(username="t@example.com", password="x"))

    def get(self, query):
        return self.client.get(f"/api/resources/matches/?{query}")

    def titles(self, query):
        resp = self.get(query)
        self.assertEqual(resp.status_code, 200, resp.content)
        return [r["title"] for r in resp.json()]

    def test_demo_parent_searches_diapers_in_37206(self):
        results = self.get("zip=37206&stage=parenting&ages=3_12mo&roles=parent&needs=essentials&category=essentials")
        results = results.json()
        self.assertEqual([r["title"] for r in results], ["Downtown Diapers", "Statewide Diapers"])
        self.assertEqual(results[0]["distance_miles"], 2)
        self.assertEqual(results[0]["reason"], "Matches Diapers and your area")
        self.assertIsNone(results[1]["distance_miles"])  # statewide is never "nearby"
        self.assertEqual(results[1]["limits"], "Children under 2")

    def test_roles_unlock_foster_and_kinship_resources(self):
        self.assertIn("Foster Closet", self.titles("zip=37206&roles=kinship&category=essentials"))
        # Prefer not to say still sees general resources, but not the role-only ones.
        titles = self.titles("zip=37206&roles=prefer_not&category=essentials")
        self.assertIn("Downtown Diapers", titles)
        self.assertNotIn("Foster Closet", titles)

    def test_age_rules(self):
        self.assertNotIn("Statewide Diapers", self.titles("zip=37206&ages=3_5yrs"))
        self.assertNotIn("Statewide Diapers", self.titles("zip=37206&stage=expecting"))
        self.assertIn("County WIC", self.titles("zip=37206&stage=expecting"))
        self.assertIn("Statewide Diapers", self.titles("zip=37206"))  # no ages given: shown, limit explains

    def test_needs_rank_first(self):
        self.assertEqual(self.titles("zip=37206&needs=housing")[0], "Downtown Housing")

    def test_radius_and_search_text(self):
        # Hendersonville is about 11 miles from East Nashville.
        self.assertNotIn("Hendersonville Housing", self.titles("zip=37206&radius=10"))
        self.assertIn("Hendersonville Housing", self.titles("zip=37206&radius=25"))
        self.assertNotIn("Cincinnati Diapers", self.titles("zip=37206&radius=50"))
        self.assertEqual(self.titles("zip=37206&q=formula"), ["National Formula Savings"])

    def test_unknown_zip_still_gets_statewide_and_national(self):
        self.assertEqual(self.titles("zip=38103"), ["National Formula Savings", "Statewide Diapers"])

    def test_bad_zip_is_a_field_error(self):
        resp = self.get("zip=abc")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("zip", resp.json())


class MatchingUnitTests(SimpleTestCase):
    def test_miles_between(self):
        self.assertEqual(miles_between("37201", "37201"), 0)
        self.assertIsNone(miles_between("37201", "99999"))

    def test_reason_lines(self):
        foster_only = Resource(
            title="X", categories=["essentials"], serves=["foster", "kinship"], area_type="statewide"
        )
        no_need = Resource(title="Y", categories=["housing"], area_type="national")
        results = match_resources([foster_only, no_need], {"zip": "37206", "roles": ["foster"], "needs": ["essentials"]})
        self.assertEqual(results[0]["reason"], "Matches Diapers and Tennessee · For foster and kinship families")
        self.assertEqual(results[1]["reason"], "May be a good fit")
        self.assertFalse(results[1]["matches_needs"])
