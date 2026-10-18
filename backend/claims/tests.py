from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import Profile
from items.models import Item, local_today

from . import actions
from .models import Claim

User = get_user_model()


def person(email, usage="get", zip_code="37206"):
    user = User.objects.create_user(username=email, first_name=email.split("@")[0].title())
    Profile.objects.create(user=user, account_type=Profile.PERSON, usage=usage, zip_code=zip_code)
    return user


def demo(name):
    """A KAN-26 demo item: Size 1 diapers (organization, 12), Baby clothes bundle, 0-3 mo (person, 1)."""
    return Item.objects.get(name=name)


class ClaimModelTests(TestCase):
    def test_starts_waiting_and_reads_well(self):
        family = User.objects.create_user(username="family@example.com")
        claim = Claim.objects.create(item=demo("Size 1 diapers"), claimant=family)
        self.assertEqual(claim.status, Claim.WAITING)
        self.assertEqual(str(claim), "family@example.com → Size 1 diapers (waiting)")


class ClaimTests(APITestCase):
    def setUp(self):
        self.family = person("taylor@example.com")
        self.client.force_authenticate(self.family)
        self.diapers = demo("Size 1 diapers")
        self.bundle = demo("Baby clothes bundle, 0-3 mo")

    def claim(self, item, user=None):
        if user:
            self.client.force_authenticate(user)
        with self.assertLogs("claims.actions", "INFO"):
            resp = self.client.post("/api/claims/", {"item": item.pk}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.json()

    def refused(self, item, code=400):
        resp = self.client.post("/api/claims/", {"item": item.pk}, format="json")
        self.assertEqual(resp.status_code, code, resp.content)
        return resp.json()["detail"]

    def left(self, item):
        return self.client.get(f"/api/items/{item.pk}/").json()["left"]

    def test_logged_out_is_401_and_organizations_are_refused(self):
        self.assertEqual(APIClient().post("/api/claims/", {"item": 1}, format="json").status_code, 401)
        self.client.force_authenticate(User.objects.get(username="team@samplecommunitycloset.example"))
        self.assertEqual(self.client.get("/api/claims/").status_code, 403)

    def test_organization_item_is_approved_at_once_and_shows_the_place(self):
        data = self.claim(self.diapers)
        self.assertEqual(data["status"], "approved")
        self.assertEqual(data["item"]["exact_address"], "100 Sample Way, Nashville, TN 37206")
        held = timezone.datetime.fromisoformat(data["held_until"].replace("Z", "+00:00"))
        # 3 days, or to the end of the pickup day when that's later (Size 1 diapers is picked up in 3 days).
        self.assertGreaterEqual(held, timezone.now() + timedelta(days=3) - timedelta(minutes=1))
        self.assertEqual(held, actions.hold_until(self.diapers))
        self.assertEqual(self.left(self.diapers), 11)

    def test_person_item_waits_and_keeps_the_place_private(self):
        data = self.claim(self.bundle)
        self.assertEqual(data["status"], "waiting")
        self.assertIsNone(data["item"]["exact_address"])
        self.assertIsNone(data["item"]["where_to_go"])
        self.assertEqual(self.left(self.bundle), 0)

    def test_the_last_one_goes_to_one_family(self):
        self.claim(self.bundle)
        self.client.force_authenticate(person("jordan@example.com"))
        self.assertEqual(self.refused(self.bundle, 409), "Someone just claimed the last one. Try searching for another.")
        self.assertNotIn("Baby clothes bundle, 0-3 mo", [i["name"] for i in self.client.get("/api/items/search/").json()])

    def test_one_of_the_same_item_at_a_time(self):
        self.claim(self.diapers)
        self.assertIn("already have a claim", self.refused(self.diapers))

    def test_cant_claim_your_own_item(self):
        self.client.force_authenticate(User.objects.get(username="casey@demo.example"))
        self.assertIn("You posted this item", self.refused(self.bundle))

    def test_gone_or_past_items(self):
        Item.objects.filter(pk=self.diapers.pk).update(pickup_date=local_today() - timedelta(days=1))
        self.assertEqual(self.refused(self.diapers, 404), "This item isn't available anymore.")
        Item.objects.filter(pk=self.bundle.pk).update(taken_down_at=timezone.now())
        self.refused(self.bundle, 404)
        resp = self.client.post("/api/claims/", {"item": 999999}, format="json")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(self.client.post("/api/claims/", {}, format="json").status_code, 400)

    def test_cancel_puts_it_back_and_moves_it_to_past(self):
        claim = self.claim(self.diapers)
        with self.assertLogs("claims.actions", "INFO"):
            resp = self.client.post(f"/api/claims/{claim['id']}/cancel/")
        self.assertEqual(resp.json()["status"], "canceled")
        self.assertEqual(self.left(self.diapers), 12)
        self.assertEqual(self.client.get("/api/claims/").json(), [])
        self.assertEqual([c["id"] for c in self.client.get("/api/claims/?tab=past").json()], [claim["id"]])
        self.assertEqual(self.client.post(f"/api/claims/{claim['id']}/cancel/").status_code, 400)
        self.claim(self.diapers)  # can claim it again after canceling

    def test_active_tab_and_someone_elses_claim(self):
        mine = self.claim(self.diapers)
        self.assertEqual([c["id"] for c in self.client.get("/api/claims/").json()], [mine["id"]])
        self.client.force_authenticate(person("jordan@example.com"))
        self.assertEqual(self.client.get("/api/claims/").json(), [])
        self.assertEqual(self.client.post(f"/api/claims/{mine['id']}/cancel/").status_code, 404)

    def test_taken_down_items_still_show_under_past(self):
        claim = self.claim(self.diapers)
        with self.assertLogs("claims.actions", "INFO"):
            self.client.post(f"/api/claims/{claim['id']}/cancel/")
        Item.objects.filter(pk=self.diapers.pk).update(taken_down_at=timezone.now())
        self.assertEqual(self.client.get("/api/claims/?tab=past").json()[0]["item"]["name"], "Size 1 diapers")

    def test_my_items_counts_and_edit_floor(self):
        self.claim(self.bundle)
        casey = User.objects.get(username="casey@demo.example")
        self.client.force_authenticate(casey)
        mine = next(i for i in self.client.get("/api/items/mine/").json() if i["id"] == self.bundle.pk)
        self.assertEqual((mine["left"], mine["requested"], mine["claimed"]), (0, 1, 0))
        resp = self.client.put(f"/api/items/mine/{self.bundle.pk}/", {**mine, "quantity": 0, "good_condition": True,
                                                                      "not_recalled": True}, format="json")
        self.assertEqual(resp.status_code, 400)
        with self.assertLogs("items.views", "INFO"):
            resp = self.client.put(f"/api/items/mine/{self.bundle.pk}/", {**mine, "quantity": 3, "good_condition": True,
                                                                          "not_recalled": True}, format="json")
        self.assertEqual(resp.json()["left"], 2)


class EndClaimTests(TestCase):
    def setUp(self):
        self.claim = Claim.objects.create(
            item=demo("Size 1 diapers"), claimant=person("taylor@example.com"), status=Claim.APPROVED
        )

    def test_each_ending_puts_the_item_back(self):
        for ending in (Claim.DECLINED, Claim.CANCELED, Claim.ENDED):
            Claim.objects.filter(pk=self.claim.pk).update(status=Claim.APPROVED)
            with self.assertLogs("claims.actions", "INFO"):
                self.assertTrue(actions.end_claim(self.claim, ending))
            self.assertEqual(Item.objects.with_counts().get(pk=self.claim.item_id).left, 12)

    def test_an_ended_claim_stays_ended(self):
        with self.assertLogs("claims.actions", "INFO"):
            actions.end_claim(self.claim, Claim.CANCELED)
        self.assertFalse(actions.end_claim(self.claim, Claim.DECLINED))
        self.assertEqual(Claim.objects.get(pk=self.claim.pk).status, Claim.CANCELED)

    def test_picked_up_is_not_an_ending_that_puts_it_back(self):
        with self.assertRaises(ValueError):
            actions.end_claim(self.claim, Claim.PICKED_UP)

    def test_lost_race_for_the_last_one(self):
        item = demo("Baby clothes bundle, 0-3 mo")
        Claim.objects.create(item=item, claimant=person("first@example.com"))  # got there first
        with self.assertRaises(actions.ClaimRefused) as refused:
            actions.claim_item(person("jordan@example.com"), item.pk)
        self.assertEqual(refused.exception.code, 409)

    def test_more_claims_than_listed_reads_as_none_left(self):
        item = demo("Baby clothes bundle, 0-3 mo")
        for n in range(2):
            Claim.objects.create(item=item, claimant=person(f"f{n}@example.com"), status=Claim.APPROVED)
        self.assertEqual(Item.objects.with_counts().get(pk=item.pk).left, -1)


class GiverAnswerTests(APITestCase):
    """KAN-13: the giver approves or declines a request, and marks an approved claim picked up."""

    def setUp(self):
        self.bundle = demo("Baby clothes bundle, 0-3 mo")
        self.casey = User.objects.get(username="casey@demo.example")
        self.family = person("taylor@example.com")
        self.family.first_name = "Taylor Smith"
        self.family.save()
        self.claim = Claim.objects.create(item=self.bundle, claimant=self.family)

    def answer(self, action, user=None, expect=200):
        self.client.force_authenticate(user or self.casey)
        resp = self.client.post(f"/api/claims/{self.claim.pk}/{action}/")
        self.assertEqual(resp.status_code, expect, resp.content)
        return resp.json()

    def family_sees(self):
        self.client.force_authenticate(self.family)
        return self.client.get(f"/api/items/{self.bundle.pk}/").json()

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().post(f"/api/claims/{self.claim.pk}/approve/").status_code, 401)

    def test_giver_sees_the_request_with_the_first_name_only(self):
        self.client.force_authenticate(self.casey)
        mine = next(i for i in self.client.get("/api/items/mine/").json() if i["id"] == self.bundle.pk)
        self.assertEqual(mine["claims"], [{"id": self.claim.pk, "status": "waiting", "held_until": None, "family": "Taylor"}])
        self.assertNotIn("Smith", str(mine))
        self.assertNotIn("taylor@example.com", str(mine))

    def test_approve_shows_the_family_the_place(self):
        self.assertIsNone(self.family_sees()["exact_address"])
        with self.assertLogs("claims.actions", "INFO"):
            data = self.answer("approve")
        self.assertEqual((data["status"], data["family"]), ("approved", "Taylor"))
        self.assertEqual(self.family_sees()["exact_address"], "400 Fictional St, Nashville, TN 37207")
        self.answer("approve", expect=400)  # already answered

    def test_decline_ends_the_claim_and_puts_the_item_back(self):
        with self.assertLogs("claims.actions", "INFO"):
            self.assertEqual(self.answer("decline")["status"], "declined")
        self.assertIsNone(self.family_sees()["exact_address"])
        self.assertEqual(self.family_sees()["left"], 1)
        self.client.force_authenticate(self.family)
        self.assertEqual(self.client.get("/api/claims/?tab=past").json()[0]["status"], "declined")

    def test_mark_picked_up(self):
        self.answer("picked-up", expect=400)  # not approved yet
        with self.assertLogs("claims.actions", "INFO"):
            self.answer("approve")
            self.assertEqual(self.answer("picked-up")["status"], "picked_up")
        self.client.force_authenticate(self.casey)
        mine = next(i for i in self.client.get("/api/items/mine/").json() if i["id"] == self.bundle.pk)
        self.assertEqual((mine["left"], mine["claims"]), (0, []))  # picked up still counts as taken
        self.assertIsNone(self.family_sees()["exact_address"])  # the claim is over

    def test_an_approved_claim_cant_be_declined(self):
        with self.assertLogs("claims.actions", "INFO"):
            self.answer("approve")
        self.answer("decline", expect=400)
        self.assertEqual(Claim.objects.get(pk=self.claim.pk).status, Claim.APPROVED)

    def test_cant_approve_on_a_taken_down_or_past_item(self):
        Item.objects.filter(pk=self.bundle.pk).update(taken_down_at=timezone.now())
        self.answer("approve", expect=400)
        Item.objects.filter(pk=self.bundle.pk).update(taken_down_at=None, pickup_date=local_today() - timedelta(days=1))
        self.answer("approve", expect=400)
        self.assertEqual(Claim.objects.get(pk=self.claim.pk).status, Claim.WAITING)

    def test_only_the_giver_can_answer(self):
        self.answer("approve", user=self.family, expect=404)
        self.answer("decline", user=person("jordan@example.com"), expect=404)
        self.assertEqual(Claim.objects.get(pk=self.claim.pk).status, Claim.WAITING)


class MissedClaimTests(APITestCase):
    """KAN-14: a hold that passes, a request with no answer, and Family didn't come all end the claim once."""

    def setUp(self):
        self.diapers = demo("Size 1 diapers")
        self.bundle = demo("Baby clothes bundle, 0-3 mo")
        self.family = person("taylor@example.com")
        self.client.force_authenticate(self.family)

    def make(self, item, status, created_days_ago=0, held_days=3):
        claim = Claim.objects.create(
            item=item, claimant=self.family, status=status, held_until=timezone.now() + timedelta(days=held_days)
        )
        Claim.objects.filter(pk=claim.pk).update(created_at=timezone.now() - timedelta(days=created_days_ago))
        return claim

    def left(self, item):
        return Item.objects.with_counts().get(pk=item.pk).left

    def past(self):
        return self.client.get("/api/claims/?tab=past").json()

    def test_a_passed_hold_ends_and_puts_the_item_back_once(self):
        claim = self.make(self.diapers, Claim.APPROVED, held_days=-1.1)  # a day of grace has passed too
        self.assertEqual(self.left(self.diapers), 11)
        with self.assertLogs("claims.actions", "INFO"):
            past = self.past()
        self.assertEqual((past[0]["status"], past[0]["end_reason"]), ("ended", "hold_ended"))
        self.assertEqual(self.left(self.diapers), 12)
        actions.expire_overdue()  # again: nothing more to end
        self.assertFalse(actions.end_claim(Claim.objects.get(pk=claim.pk), Claim.ENDED))
        self.assertEqual(self.left(self.diapers), 12)

    def test_a_request_with_no_answer_for_2_days_ends(self):
        self.make(self.bundle, Claim.WAITING, created_days_ago=2.1)
        with self.assertLogs("claims.actions", "INFO"):
            past = self.past()
        self.assertEqual(past[0]["end_reason"], "no_answer")
        self.assertEqual(self.left(self.bundle), 1)

    def test_an_approved_hold_gets_a_day_of_grace_to_mark_picked_up(self):
        claim = self.make(self.diapers, Claim.APPROVED, held_days=-0.5)
        actions.expire_overdue()
        self.assertEqual(Claim.objects.get(pk=claim.pk).status, Claim.APPROVED)

    def test_approving_restarts_the_hold(self):
        claim = self.make(self.bundle, Claim.WAITING, created_days_ago=1.9, held_days=1.1)
        with self.assertLogs("claims.actions", "INFO"):
            self.assertTrue(actions.approve_claim(claim))
        self.assertGreater(Claim.objects.get(pk=claim.pk).held_until, timezone.now() + timedelta(days=2.9))

    def test_cancel_after_the_hold_passed_reads_as_ended(self):
        claim = self.make(self.diapers, Claim.APPROVED, held_days=-1.1)
        with self.assertLogs("claims.actions", "INFO"):
            resp = self.client.post(f"/api/claims/{claim.pk}/cancel/")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Claim.objects.get(pk=claim.pk).end_reason, "hold_ended")

    def test_current_claims_stay(self):
        self.make(self.diapers, Claim.APPROVED, created_days_ago=2.5, held_days=1)
        self.make(self.bundle, Claim.WAITING, created_days_ago=1)
        self.assertEqual(len(self.client.get("/api/claims/").json()), 2)

    def test_picked_up_claims_never_go_back(self):
        self.make(self.diapers, Claim.PICKED_UP, created_days_ago=10, held_days=-7)
        actions.expire_overdue()
        self.assertEqual(self.left(self.diapers), 11)

    def test_search_and_item_pages_expire_first(self):
        self.make(self.bundle, Claim.APPROVED, held_days=-1.1)
        with self.assertLogs("claims.actions", "INFO"):
            self.assertEqual(self.client.get(f"/api/items/{self.bundle.pk}/").json()["left"], 1)

    def test_family_didnt_come(self):
        claim = self.make(self.bundle, Claim.WAITING)
        casey = User.objects.get(username="casey@demo.example")
        self.client.force_authenticate(casey)
        self.assertEqual(self.client.post(f"/api/claims/{claim.pk}/didnt-come/").status_code, 400)  # not approved
        Claim.objects.filter(pk=claim.pk).update(status=Claim.APPROVED)
        self.assertEqual(self.client.post(f"/api/claims/{claim.pk}/didnt-come/").status_code, 400)  # before pickup day
        Item.objects.filter(pk=self.bundle.pk).update(pickup_date=local_today())
        with self.assertLogs("claims.actions", "INFO"):
            resp = self.client.post(f"/api/claims/{claim.pk}/didnt-come/")
        self.assertEqual(resp.json()["status"], "ended")
        self.assertEqual(self.left(self.bundle), 1)
        self.assertEqual(self.client.post(f"/api/claims/{claim.pk}/didnt-come/").status_code, 400)  # only once
        self.client.force_authenticate(self.family)
        self.assertEqual(self.past()[0]["end_reason"], "no_show")
        self.assertEqual(self.client.post(f"/api/claims/{claim.pk}/didnt-come/").status_code, 404)  # not the giver


class CalendarTests(APITestCase):
    """KAN-19: the calendar file and the Pickup details changed notice."""

    def setUp(self):
        self.family = person("taylor@example.com")
        self.client.force_authenticate(self.family)
        self.diapers = demo("Size 1 diapers")
        self.bundle = demo("Baby clothes bundle, 0-3 mo")

    def claim(self, item, status):
        return Claim.objects.create(
            item=item, claimant=self.family, status=status, held_until=timezone.now() + timedelta(days=3)
        )

    def ics(self, claim, query=""):
        resp = self.client.get(f"/api/claims/{claim.pk}/calendar.ics{query}")
        self.assertEqual(resp.status_code, 200, resp.content)
        return resp, resp.content.decode().replace("\r\n ", "")  # unfold long lines

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().get("/api/claims/1/calendar.ics").status_code, 401)

    def test_event_has_the_item_time_place_notes_and_reminders(self):
        claim = self.claim(self.diapers, Claim.APPROVED)
        resp, text = self.ics(claim, "?reminders=day,hour,bogus")
        self.assertEqual(resp["Content-Type"], "text/calendar; charset=utf-8")
        self.assertIn("inline", resp["Content-Disposition"])
        self.assertIn("SUMMARY:Pick up: Size 1 diapers", text)
        self.assertIn("LOCATION:100 Sample Way\\, Nashville\\, TN 37206", text)
        self.assertIn("DESCRIPTION:Front desk. Ask for the Baby Closet. Bring a bag. Pack of 30. New and unopened.",
                      text)
        # 10 am - 2 pm in Nashville is 15:00-19:00 UTC (CDT) or 16:00-20:00 (CST).
        self.assertRegex(text, r"DTSTART:\d{8}T1[56]0000Z")
        self.assertRegex(text, r"DTEND:\d{8}T(19|20)0000Z")
        self.assertIn("TRIGGER:-P1D", text)
        self.assertIn("TRIGGER:-PT1H", text)
        self.assertEqual(text.count("BEGIN:VALARM"), 2)
        self.assertTrue(all(len(line.encode()) <= 75 for line in resp.content.decode().split("\r\n")))

    def test_admin_line_breaks_and_sequence(self):
        Item.objects.filter(pk=self.diapers.pk).update(what_to_bring="Bring a bag.\r\nCash not needed.")
        claim = self.claim(self.diapers, Claim.APPROVED)
        resp, text = self.ics(claim)
        self.assertNotIn("\r\\n", resp.content.decode())
        self.assertIn("Bring a bag.\\nCash not needed.", text)
        self.assertIn("SEQUENCE:0", text)
        Item.objects.filter(pk=self.diapers.pk).update(pickup_changed_at=timezone.now())
        _, text = self.ics(claim)
        self.assertNotIn("SEQUENCE:0", text)

    def test_only_approved_claims_get_a_calendar(self):
        claim = self.claim(self.bundle, Claim.WAITING)
        self.assertEqual(self.client.get(f"/api/claims/{claim.pk}/calendar.ics").status_code, 404)
        self.assertEqual(self.client.get(f"/api/claims/{claim.pk}/").status_code, 404)
        Claim.objects.filter(pk=claim.pk).update(status=Claim.APPROVED)
        resp, text = self.ics(claim, "?download=1")
        self.assertIn("attachment", resp["Content-Disposition"])
        self.assertIn("400 Fictional St", text)
        event = self.client.get(f"/api/claims/{claim.pk}/").json()["event"]
        self.assertEqual(event["where"], "400 Fictional St, Nashville, TN 37207")
        self.assertIn("Front porch. Look for the blue bin.", event["notes"])

    def test_no_exact_address_while_the_place_is_private(self):
        claim = self.claim(self.bundle, Claim.APPROVED)
        with mock.patch("items.privacy.can_see_exact_address", return_value=False):
            _, text = self.ics(claim)
        self.assertIn("LOCATION:East Nashville", text)
        self.assertNotIn("400 Fictional", text)
        self.assertNotIn("blue bin", text)  # Where to go is private too

    def test_only_your_own_current_claims(self):
        claim = self.claim(self.diapers, Claim.CANCELED)
        self.assertEqual(self.client.get(f"/api/claims/{claim.pk}/calendar.ics").status_code, 404)
        mine = self.claim(self.diapers, Claim.APPROVED)
        self.client.force_authenticate(person("jordan@example.com"))
        self.assertEqual(self.client.get(f"/api/claims/{mine.pk}/calendar.ics").status_code, 404)
        self.assertEqual(self.client.get(f"/api/claims/{mine.pk}/").status_code, 404)

    def test_change_notice_until_the_calendar_is_updated(self):
        claim = self.claim(self.bundle, Claim.APPROVED)
        self.assertFalse(self.client.get(f"/api/claims/{claim.pk}/").json()["pickup_changed"])
        casey = User.objects.get(username="casey@demo.example")
        self.client.force_authenticate(casey)
        mine = self.client.get(f"/api/items/mine/{self.bundle.pk}/").json()
        with self.assertLogs("items.views", "INFO"):
            self.client.put(f"/api/items/mine/{self.bundle.pk}/", {**mine, "quantity": 1, "pickup_start": "16:00",
                            "good_condition": True, "not_recalled": True}, format="json")
        self.client.force_authenticate(self.family)
        self.assertTrue(self.client.get(f"/api/claims/{claim.pk}/").json()["pickup_changed"])
        self.ics(claim)
        self.assertFalse(self.client.get(f"/api/claims/{claim.pk}/").json()["pickup_changed"])

    def test_editing_only_the_details_isnt_a_pickup_change(self):
        claim = self.claim(self.bundle, Claim.APPROVED)
        casey = User.objects.get(username="casey@demo.example")
        self.client.force_authenticate(casey)
        mine = self.client.get(f"/api/items/mine/{self.bundle.pk}/").json()
        with self.assertLogs("items.views", "INFO"):
            self.client.put(f"/api/items/mine/{self.bundle.pk}/", {**mine, "quantity": 1, "details": "Seven pieces.",
                            "good_condition": True, "not_recalled": True}, format="json")
        self.client.force_authenticate(self.family)
        self.assertFalse(self.client.get(f"/api/claims/{claim.pk}/").json()["pickup_changed"])


class PickupProblemTests(APITestCase):
    """KAN-20: a family reports a pickup problem; the claim is released, the item paused, the giver told the reason."""

    def setUp(self):
        self.family = person("taylor@example.com")
        self.family.first_name = "Taylor Smith"
        self.family.save()
        self.bundle = demo("Baby clothes bundle, 0-3 mo")
        Item.objects.filter(pk=self.bundle.pk).update(pickup_date=local_today(), pickup_start="00:00", pickup_end="23:59")
        self.claim = Claim.objects.create(
            item=self.bundle, claimant=self.family, status=Claim.APPROVED, held_until=timezone.now() + timedelta(days=3)
        )
        self.client.force_authenticate(self.family)

    def report(self, expect=201, **body):
        resp = self.client.post(f"/api/claims/{self.claim.pk}/report/", {"reason": "not_there", **body}, format="json")
        self.assertEqual(resp.status_code, expect, resp.content)
        return resp.json()

    def test_logged_out_is_401(self):
        self.assertEqual(APIClient().post(f"/api/claims/{self.claim.pk}/report/", {}, format="json").status_code, 401)

    def test_report_releases_the_claim_pauses_the_item_and_saves_it_for_the_team(self):
        self.assertTrue(self.client.get("/api/claims/").json()[0]["can_report"])
        with self.assertLogs("claims.actions", "INFO"):
            data = self.report(note="Porch was empty at 5:30.")
        self.assertEqual(data, {"reason": "The item wasn't there", "chip": "essentials"})
        claim = Claim.objects.get(pk=self.claim.pk)
        self.assertEqual((claim.status, claim.end_reason), (Claim.ENDED, Claim.PROBLEM))
        self.assertEqual(claim.report.note, "Porch was empty at 5:30.")
        self.assertIsNotNone(Item.objects.get(pk=self.bundle.pk).paused_at)
        self.assertEqual(self.client.get("/api/claims/?tab=past").json()[0]["end_reason"], "problem")
        self.assertFalse(self.client.get(f"/api/items/{self.bundle.pk}/").json()["available"])
        self.assertNotIn(self.bundle.pk, [i["id"] for i in self.client.get("/api/items/search/?radius=50").json()])

    def test_giver_sees_only_the_reason_and_can_unpause(self):
        with self.assertLogs("claims.actions", "INFO"):
            self.report(note="Secret note for the team")
        casey = User.objects.get(username="casey@demo.example")
        self.client.force_authenticate(casey)
        mine = next(i for i in self.client.get("/api/items/mine/").json() if i["id"] == self.bundle.pk)
        self.assertEqual(mine["paused"], "The item wasn't there")
        self.assertNotIn("Secret", str(mine))
        self.assertNotIn("Taylor", str(mine))
        with self.assertLogs("items.views", "INFO"):
            resp = self.client.post(f"/api/items/mine/{self.bundle.pk}/available/")
        self.assertIsNone(resp.json()["paused"])
        self.assertEqual(self.client.post(f"/api/items/mine/{self.bundle.pk}/available/").status_code, 404)
        self.client.force_authenticate(self.family)
        self.assertTrue(self.client.get(f"/api/items/{self.bundle.pk}/").json()["available"])

    def test_paused_items_cant_be_claimed_or_approved(self):
        Item.objects.filter(pk=self.bundle.pk).update(paused_at=timezone.now(), quantity=2)
        self.client.force_authenticate(person("jordan@example.com"))
        resp = self.client.post("/api/claims/", {"item": self.bundle.pk}, format="json")
        self.assertEqual(resp.status_code, 404)
        waiting = Claim.objects.create(item=self.bundle, claimant=person("morgan@example.com"))
        self.assertFalse(actions.approve_claim(waiting))

    def test_admin_lists_reports_without_adding_and_unpauses_items(self):
        with self.assertLogs("claims.actions", "INFO"):
            self.report()
        admin_user = User.objects.create_superuser(username="admin@example.com", password="x")
        self.client.force_login(admin_user)
        self.assertContains(self.client.get("/admin/claims/pickupreport/"), "Baby clothes bundle")
        self.assertEqual(self.client.get("/admin/claims/pickupreport/add/").status_code, 403)
        resp = self.client.post("/admin/items/item/", {"action": "unpause", "_selected_action": [self.bundle.pk]},
                                follow=True)
        self.assertContains(resp, "Put 1 paused item(s) back in search.")
        self.assertIsNone(Item.objects.get(pk=self.bundle.pk).paused_at)

    def test_only_inside_the_window_and_only_approved(self):
        Item.objects.filter(pk=self.bundle.pk).update(pickup_date=local_today() + timedelta(days=2))
        self.assertIn("pickup window", self.report(expect=400)["detail"])
        self.assertFalse(self.client.get("/api/claims/").json()[0]["can_report"])
        Item.objects.filter(pk=self.bundle.pk).update(pickup_date=local_today() - timedelta(days=3))
        self.report(expect=400)
        Item.objects.filter(pk=self.bundle.pk).update(pickup_date=local_today())
        Claim.objects.filter(pk=self.claim.pk).update(status=Claim.WAITING)
        self.report(expect=400)

    def test_bad_answers(self):
        self.assertIn("reason", self.report(expect=400, reason="angry"))
        self.assertIn("note", self.report(expect=400, note="x" * 201))

    def test_only_your_own_claim(self):
        self.client.force_authenticate(person("jordan@example.com"))
        self.report(expect=404)

    def test_failed_report_saves_nothing(self):
        with mock.patch("claims.actions.PickupReport.objects.create", side_effect=DatabaseError("boom")), \
                self.assertRaises(DatabaseError), self.assertLogs("django.request", "ERROR"):
            self.report()
        self.assertEqual(Claim.objects.get(pk=self.claim.pk).status, Claim.APPROVED)
        self.assertIsNone(Item.objects.get(pk=self.bundle.pk).paused_at)
