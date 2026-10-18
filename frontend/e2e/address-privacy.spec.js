import { expect, test } from "@playwright/test";
import { myItemId, postItem, saveOrgProfile, signupPerson, signupVerifiedOrg } from "./helpers.js";

// KAN-11: a person's exact pickup place reaches only the giver (and, later, an approved family).
test("only the giver sees a person's exact address; an organization's address is public", async ({ browser }) => {
  const giver = await (await browser.newContext()).newPage();
  await signupPerson(giver, { name: "Jordan Lee", zip: "37206", usage: "Give support" });
  await postItem(giver, { name: "Bassinet", address: "12 Sample Ave, Nashville, TN 37206" });
  const personItem = await myItemId(giver, "/give", "Bassinet");
  const own = await (await giver.request.get(`/api/items/${personItem}/`)).json();
  expect(own.exact_address).toBe("12 Sample Ave, Nashville, TN 37206");

  const org = await (await browser.newContext()).newPage();
  await signupVerifiedOrg(org, { name: "Sample Community Closet" });
  await saveOrgProfile(org, "100 Sample Way, Nashville, TN 37206");
  await postItem(org, { name: "Car seat" });
  const orgItem = await myItemId(org, "/org/items", "Car seat");

  const family = await (await browser.newContext()).newPage();
  await signupPerson(family, { name: "Taylor Kim", zip: "37208", usage: "Get support" });
  const seen = await (await family.request.get(`/api/items/${personItem}/`)).json();
  expect(seen.exact_address).toBeNull();
  expect(seen.where_to_go).toBeNull();
  expect(seen.private_note).toMatch(/^Private\./);
  expect(seen.general_area).toBe("East Nashville");
  expect(seen.giver).not.toContain("Lee");
  expect(Number.isInteger(seen.distance_miles)).toBe(true);

  const orgSeen = await (await family.request.get(`/api/items/${orgItem}/`)).json();
  expect(orgSeen.exact_address).toBe("100 Sample Way, Nashville, TN 37206");
  expect(orgSeen.giver).toBe("Sample Community Closet");

  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(`/api/items/${personItem}/`, { baseURL: test.info().project.use.baseURL })).status()).toBe(401);
});
