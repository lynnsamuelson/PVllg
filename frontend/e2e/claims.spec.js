import { expect, test } from "@playwright/test";
import { claimItem, myItemId, nashvilleToday, postItem, saveOrgProfile, signupPerson, signupVerifiedOrg } from "./helpers.js";

const card = (page, name) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
const newPage = async (browser) => (await browser.newContext()).newPage();

async function personGiverWithItem(browser, name, options = {}) {
  const giver = await newPage(browser);
  await signupPerson(giver, { name: "Jordan Lee", zip: "37206", usage: "Give support" });
  await postItem(giver, { name, address: "12 Sample Ave, Nashville, TN 37206", ...options });
  return { giver, id: await myItemId(giver, "/give", name) };
}

async function family(browser, name = "Taylor Kim") {
  const page = await newPage(browser);
  await signupPerson(page, { name, zip: "37208", usage: "Get support" });
  return page;
}

// KAN-12: an organization's item is Approved at once; canceling puts it back.
test("a family claims an organization's item, sees where to go, and cancels", async ({ browser }) => {
  const org = await newPage(browser);
  await signupVerifiedOrg(org);
  await saveOrgProfile(org, "100 Sample Way, Nashville, TN 37206");
  const name = `Diapers ${Date.now()}`;
  await postItem(org, { name, quantity: 2 });
  const id = await myItemId(org, "/org/items", name);

  const page = await family(browser);
  await claimItem(page, id);
  const claim = card(page, name);
  await expect(claim).toContainText("Approved");
  await expect(claim).toContainText(/Hold ends in \d+ days?/);
  await expect(claim).toContainText("100 Sample Way, Nashville, TN 37206");

  await page.goto(`/items/${id}`);
  await expect(page.getByRole("heading", { name: "1 left" })).toBeVisible();

  await page.goto("/claims");
  await claim.getByRole("button", { name: "Cancel claim" }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(claim).toHaveCount(0);
  await page.getByRole("tab", { name: "Past" }).click();
  await expect(card(page, name)).toContainText("Canceled");
  await page.goto(`/items/${id}`);
  await expect(page.getByRole("heading", { name: "2 left" })).toBeVisible();
});

// KAN-11, KAN-12, KAN-13: a person's item waits for the giver, and approval shares the exact place.
test("a giver approves a request, the family sees the address, and pickup hides it again", async ({ browser }) => {
  const name = `Bassinet ${Date.now()}`;
  const { giver, id } = await personGiverWithItem(browser, name);
  const page = await family(browser);

  await claimItem(page, id);
  await expect(card(page, name)).toContainText("Waiting");
  await expect(card(page, name)).toContainText("The giver hasn't answered yet. Exact pickup details appear after approval.");
  await expect(card(page, name)).not.toContainText("12 Sample Ave");

  await giver.goto("/give");
  const request = card(giver, name);
  await expect(request).toContainText("1 listed · 1 requested");
  await expect(request.getByText("Taylor", { exact: true })).toBeVisible();
  await expect(request.getByText("wants this item.")).toBeVisible();
  await expect(request).not.toContainText("Kim");
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(request).toContainText("Approved for Taylor");
  await expect(request).toContainText("0 left · 1 claimed");

  await page.reload();
  await expect(card(page, name)).toContainText("Approved");
  await expect(card(page, name)).toContainText("12 Sample Ave, Nashville, TN 37206");

  await request.getByRole("button", { name: "Mark picked up" }).click();
  await expect(request.getByRole("button", { name: "Mark picked up" })).toHaveCount(0);
  await page.reload();
  await expect(card(page, name)).toHaveCount(0);
  await page.getByRole("tab", { name: "Past" }).click();
  await expect(card(page, name)).toContainText("Picked up");
  const item = await (await page.request.get(`/api/items/${id}/`)).json();
  expect(item.exact_address).toBeNull();
});

// KAN-13: declining ends the request and puts the item back.
test("a giver declines a request and the item goes back on the list", async ({ browser }) => {
  const name = `Swing ${Date.now()}`;
  const { giver, id } = await personGiverWithItem(browser, name);
  const page = await family(browser);
  await claimItem(page, id);

  await giver.goto("/give");
  await card(giver, name).getByRole("button", { name: "Decline" }).click();
  await expect(card(giver, name)).toContainText("1 left");
  await expect(card(giver, name)).not.toContainText("wants this item");

  await page.goto("/claims?tab=past");
  await expect(card(page, name)).toContainText("Declined");
  await expect(card(page, name)).toContainText("The giver declined.");
});

// KAN-14: on the pickup day the giver can say the family didn't come, and the item goes back.
test("a giver marks that the family didn't come", async ({ browser }) => {
  const name = `Playmat ${Date.now()}`;
  const { giver, id } = await personGiverWithItem(browser, name, { date: nashvilleToday() });
  const page = await family(browser);
  await claimItem(page, id);
  await giver.goto("/give");
  await card(giver, name).getByRole("button", { name: "Approve" }).click();

  await card(giver, name).getByRole("button", { name: "Family didn't come" }).click();
  await expect(card(giver, name)).toContainText("Taylor's claim ends and the item goes back on the list. This can't be undone.");
  await card(giver, name).getByRole("button", { name: "Keep it" }).click();
  await expect(card(giver, name)).toContainText("Approved for Taylor");
  await card(giver, name).getByRole("button", { name: "Family didn't come" }).click();
  await card(giver, name).getByRole("button", { name: "Yes, they didn't come" }).click();
  await expect(card(giver, name)).toContainText("1 left");

  await page.goto("/claims?tab=past");
  await expect(card(page, name)).toContainText("The giver marked it not picked up.");
});

// KAN-12: only one family gets the last one.
test("when two families try for the last one, the second is told it's gone", async ({ browser }) => {
  const name = `Car seat ${Date.now()}`;
  const { id } = await personGiverWithItem(browser, name);
  const first = await family(browser, "Taylor Kim");
  const second = await family(browser, "Morgan Diaz");
  await second.goto(`/items/${id}`);
  await expect(second.getByRole("button", { name: "Request to claim" })).toBeEnabled();

  await claimItem(first, id);
  await second.getByRole("button", { name: "Request to claim" }).click();
  await expect(second.getByText("Someone just claimed the last one. Try searching for another.")).toBeVisible();
  await expect(second.getByRole("heading", { name: "Not available" })).toBeVisible();
});
