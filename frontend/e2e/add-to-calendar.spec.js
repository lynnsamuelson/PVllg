import { expect, test } from "@playwright/test";
import { claimItem, myItemId, postItem, saveOrgProfile, signupPerson, signupVerifiedOrg } from "./helpers.js";

const card = (page, name) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
const newPage = async (browser) => (await browser.newContext()).newPage();
const ics = async (page, href) => (await page.request.get(href)).text();

// KAN-19, Mock Ups 15-16.
test("a family adds an approved pickup to their calendar and hears when it changes", async ({ browser }) => {
  const org = await newPage(browser);
  await signupVerifiedOrg(org);
  await saveOrgProfile(org, "100 Sample Way, Nashville, TN 37206");
  const name = `Wipes ${Date.now()}`;
  await postItem(org, { name, quantity: 2 });
  const id = await myItemId(org, "/org/items", name);

  const page = await newPage(browser);
  await signupPerson(page, { zip: "37208", usage: "Get support" });
  await claimItem(page, id);
  await card(page, name).getByRole("link", { name: "Add to calendar" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Add to your calendar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Pick up: ${name}` })).toBeVisible();
  await expect(page.getByText("100 Sample Way, Nashville, TN 37206")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "1 day before" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "1 hour before" })).toBeChecked();

  const add = page.getByRole("link", { name: "Add to calendar" });
  const download = page.getByRole("link", { name: "Download calendar file" });
  const file = await ics(page, await add.getAttribute("href"));
  expect(file).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(file).toContain(`SUMMARY:Pick up: ${name}`);
  expect(file).toContain("LOCATION:100 Sample Way\\, Nashville\\, TN 37206");
  expect(file.match(/BEGIN:VALARM/g)).toHaveLength(2);
  expect(file).toMatch(/SEQUENCE:0\r\n/);

  await page.getByRole("checkbox", { name: "1 hour before" }).uncheck();
  expect((await ics(page, await add.getAttribute("href"))).match(/BEGIN:VALARM/g)).toHaveLength(1);
  const saved = await page.request.get(await download.getAttribute("href"));
  expect(saved.headers()["content-disposition"]).toMatch(/^attachment; filename="pvill-pickup-\d+\.ics"$/);

  // The organization moves; the family's card says to update the calendar until they add the new file.
  await saveOrgProfile(org, "200 Other Rd, Nashville, TN 37208");
  await page.goto("/claims");
  await expect(card(page, name)).toContainText("Pickup details changed. Update your calendar.");
  await card(page, name).getByRole("link", { name: "Add to calendar" }).click();
  await expect(page.getByText("200 Other Rd, Nashville, TN 37208")).toBeVisible();
  const updated = await ics(page, await page.getByRole("link", { name: "Add to calendar" }).getAttribute("href"));
  expect(updated).toContain("LOCATION:200 Other Rd\\, Nashville\\, TN 37208");
  expect(updated).not.toMatch(/SEQUENCE:0\r\n/);
  await page.goto("/claims");
  await expect(card(page, name)).not.toContainText("Pickup details changed.");
});

test("a giver edits the pickup time from My items after a claim, and the family hears", async ({ browser }) => {
  const org = await newPage(browser);
  await signupVerifiedOrg(org);
  await saveOrgProfile(org);
  const name = `Onesies ${Date.now()}`;
  await postItem(org, { name, quantity: 2 });
  const id = await myItemId(org, "/org/items", name);

  const page = await newPage(browser);
  await signupPerson(page, { zip: "37208", usage: "Get support" });
  await claimItem(page, id);
  await expect(card(page, name)).toContainText("Approved");
  await expect(card(page, name)).not.toContainText("Pickup details changed.");

  await org.goto("/org/items");
  await expect(card(org, name)).toContainText("Approved");
  await expect(card(org, name).getByRole("button", { name: "Take down" })).toHaveCount(0);
  await card(org, name).getByRole("link", { name: "Edit" }).click();
  await org.getByRole("button", { name: "Next: pickup details" }).click();
  await org.getByLabel("To", { exact: true }).fill("20:00");
  await org.getByRole("button", { name: "Save changes" }).click();
  await expect(org.getByText(`Saved ${name}.`)).toBeVisible();

  await page.goto("/claims");
  await expect(card(page, name)).toContainText("5 - 8 pm");
  await expect(card(page, name)).toContainText("Pickup details changed. Update your calendar.");
});

test("a waiting request can't go in a calendar", async ({ browser }) => {
  const giver = await newPage(browser);
  await signupPerson(giver, { zip: "37206", usage: "Give support" });
  const name = `Stroller ${Date.now()}`;
  await postItem(giver, { name, address: "12 Sample Ave, Nashville, TN 37206" });
  const id = await myItemId(giver, "/give", name);

  const page = await newPage(browser);
  await signupPerson(page, { zip: "37208", usage: "Get support" });
  await claimItem(page, id);
  await expect(card(page, name)).toContainText("Waiting");
  await expect(card(page, name).getByRole("link", { name: "Add to calendar" })).toHaveCount(0);

  const [claim] = (await (await page.request.get("/api/claims/")).json()).filter((c) => c.item.name === name);
  await page.goto(`/claims/${claim.id}/calendar`);
  await expect(page.getByText("Only an approved claim can go in your calendar.")).toBeVisible();
  expect((await page.request.get(`/api/claims/${claim.id}/calendar.ics`)).status()).toBe(404);
});
