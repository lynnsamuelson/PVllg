import { expect, test } from "@playwright/test";
import { claimItem, myItemId, postItem, saveOrgProfile, signupPerson, signupVerifiedOrg } from "./helpers.js";

const card = (page, name) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
const tile = (page, label) => page.getByRole("listitem").filter({ hasText: new RegExp(`^.*${label}$`) });
const newPage = async (browser) => (await browser.newContext()).newPage();

async function expectTiles(page, numbers) {
  for (const [label, value] of Object.entries(numbers)) {
    await expect(tile(page, label).locator("strong")).toHaveText(value);
  }
}

// KAN-23, Mock Up 10.
test("an organization's Impact tab counts its own posts, claims and pickups", async ({ browser }) => {
  const org = await newPage(browser);
  await signupVerifiedOrg(org, { name: "Sample Community Closet" });
  await saveOrgProfile(org, "100 Sample Way, Nashville, TN 37206");
  await org.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Impact" }).click();
  await expect(org.getByText("Sample Community Closet, last 30 days")).toBeVisible();
  await expect(org.getByText("Example data", { exact: true })).toHaveCount(0);
  await expect(org.getByText(/^Nothing yet in the last 30 days\./)).toBeVisible();
  await expectTiles(org, { "Families helped": "0", "Items posted": "0", "Estimated savings": "$0" });

  // Two cribs (Furniture). One family picks one up; another claims and cancels.
  const name = `Crib ${Date.now()}`;
  await postItem(org, { name, quantity: 2 });
  const id = await myItemId(org, "/org/items", name);
  const picker = await newPage(browser);
  await signupPerson(picker, { name: "Taylor Kim", zip: "37208", usage: "Get support" });
  await claimItem(picker, id);
  const canceler = await newPage(browser);
  await signupPerson(canceler, { name: "Morgan Diaz", zip: "37208", usage: "Get support" });
  await claimItem(canceler, id);
  await card(canceler, name).getByRole("button", { name: "Cancel claim" }).click();
  await canceler.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(card(canceler, name)).toHaveCount(0);

  await org.goto("/org/items");
  await card(org, name).getByRole("button", { name: "Mark picked up" }).click();
  await expect(card(org, name).getByRole("button", { name: "Mark picked up" })).toHaveCount(0);

  await org.goto("/impact");
  await expect(org.getByText(/^Nothing yet/)).toHaveCount(0);
  await expectTiles(org, {
    "Families helped": "1",
    "Items posted": "2",
    "Items claimed": "2",
    "Items picked up": "1",
    "Returned to the list": "1",
    "Estimated savings": "$60",
  });
});

test("Impact is for organizations", async ({ page }) => {
  await signupPerson(page);
  await page.goto("/impact");
  await expect(page.getByText("Impact numbers are for organizations.")).toBeVisible();
});
