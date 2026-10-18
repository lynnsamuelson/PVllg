import { expect, test } from "@playwright/test";
import { claimItem, isoDate, myItemId, nashvilleToday, postItem, signupPerson } from "./helpers.js";

const card = (page, name) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
const newPage = async (browser) => (await browser.newContext()).newPage();

// An approved claim on a person's item. Today's window is open all day, so Problem with pickup shows.
async function approvedClaim(browser, name, { date = nashvilleToday() } = {}) {
  const giver = await newPage(browser);
  await signupPerson(giver, { name: "Jordan Lee", zip: "37206", usage: "Give support" });
  await postItem(giver, { name, date, from: "00:00", to: "23:59" });
  const id = await myItemId(giver, "/give", name);
  const family = await newPage(browser);
  await signupPerson(family, { name: "Taylor Kim", zip: "37208", usage: "Get support" });
  await claimItem(family, id);
  await giver.goto("/give");
  await card(giver, name).getByRole("button", { name: "Approve" }).click();
  await expect(card(giver, name)).toContainText("Approved for Taylor");
  await family.reload();
  return { giver, family, id };
}

// KAN-20, Mock Ups 15, 17 and 18.
test("a family reports a pickup problem, and the giver puts the item back", async ({ browser }) => {
  const name = `Crib mattress ${Date.now()}`;
  const { giver, family, id } = await approvedClaim(browser, name);

  await card(family, name).getByRole("link", { name: "Problem with pickup" }).click();
  await expect(family.getByRole("heading", { level: 1, name: "What happened at pickup?" })).toBeVisible();
  await expect(family.getByText("In an emergency, call 911.")).toBeVisible();
  await family.getByRole("button", { name: "Send report" }).click();
  await expect(family.getByText("Pick what happened.")).toBeVisible();

  await family.getByRole("radio", { name: "The item wasn't there" }).check();
  await family.getByLabel("Short note (optional)").fill("Knocked twice, nobody answered.");
  await family.getByRole("button", { name: "Send report" }).click();
  await expect(family.getByRole("heading", { level: 1, name: "Thank you. We're sorry this happened." })).toBeVisible();
  await expect(family.getByText('"A family reported: The item wasn\'t there." Your name and note are not shared.')).toBeVisible();

  await family.getByRole("link", { name: "Back to My claims" }).click();
  await expect(card(family, name)).toHaveCount(0);
  await family.getByRole("tab", { name: "Past" }).click();
  await expect(card(family, name)).toContainText("You reported a problem.");

  // Paused: out of search until the giver says it's there. The giver never sees the name or note.
  await family.goto(`/search?q=${encodeURIComponent(name)}`);
  await expect(family.getByText(/Nothing found within 10 miles/)).toBeVisible();
  await giver.goto("/give");
  await expect(card(giver, name)).toContainText('Paused. A family reported: "The item wasn\'t there."');
  await expect(card(giver, name)).not.toContainText("Taylor");
  await expect(card(giver, name)).not.toContainText("Knocked twice");
  await card(giver, name).getByRole("button", { name: "Yes, it is available" }).click();
  await expect(card(giver, name)).not.toContainText("Paused.");
  await family.reload();
  await expect(family.getByRole("link").filter({ has: family.getByRole("heading", { name }) })).toBeVisible();
  expect((await (await family.request.get(`/api/items/${id}/`)).json()).available).toBe(true);
});

test("Problem with pickup waits for the pickup window", async ({ browser }) => {
  const name = `Bath seat ${Date.now()}`;
  const { family } = await approvedClaim(browser, name, { date: isoDate(3) });
  await expect(card(family, name)).toContainText("Approved");
  await expect(card(family, name).getByRole("link", { name: "Problem with pickup" })).toHaveCount(0);
});
