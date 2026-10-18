import { expect, test } from "@playwright/test";
import { myItemId, postItem, signupPerson } from "./helpers.js";

const result = (page, name) => page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) });

// KAN-17, Mock Ups 13 and 14.
test("a family opens an organization's item from search and goes back to the same results", async ({ page }) => {
  await signupPerson(page, { zip: "37206", usage: "Get support" });
  await page.goto("/search?q=diapers");
  await result(page, "Size 1 diapers").click();

  await expect(page.getByRole("heading", { level: 1, name: "Size 1 diapers" })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /\d+ left/ })).toBeVisible();
  await expect(page.getByText("Giver confirmed: good condition, not recalled")).toBeVisible();
  await expect(page.getByText(/\(organization address\)$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim one (held for 3 days)" })).toBeEnabled();

  await page.getByRole("button", { name: "← Results" }).click();
  await expect(page).toHaveURL(/\/search\?q=diapers$/);
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("diapers");
});

test("a person's item keeps the giver and the place private, and the giver sees Edit instead", async ({ browser }) => {
  const giver = await (await browser.newContext()).newPage();
  await signupPerson(giver, { name: "Jordan Lee", zip: "37206", usage: "Give support" });
  const name = `Bouncer ${Date.now()}`;
  await postItem(giver, { name, address: "12 Sample Ave, Nashville, TN 37206", photo: true });
  const id = await myItemId(giver, "/give", name);

  await giver.goto(`/items/${id}`);
  await expect(giver.getByRole("link", { name: "This is your item. Edit it" })).toBeVisible();
  await expect(giver.getByRole("button", { name: "Request to claim" })).toHaveCount(0);

  const family = await (await browser.newContext()).newPage();
  await signupPerson(family, { name: "Taylor Kim", zip: "37208", usage: "Get support" });
  await family.goto(`/items/${id}`);
  await expect(family.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(family.getByText("A parent nearby")).toBeVisible();
  await expect(family.getByText("Person", { exact: true })).toBeVisible();
  await expect(family.getByText("Jordan")).toHaveCount(0);
  await expect(family.getByRole("heading", { name: "Pickup window" })).toBeVisible();
  await expect(family.getByText(/^East Nashville · about \d+ miles?$/)).toBeVisible();
  await expect(family.getByText("12 Sample Ave")).toHaveCount(0);
  await expect(family.getByText(/^Private\./)).toBeVisible();
  await expect(family.getByRole("img", { name: `${name}, photo 1` })).toBeVisible();
  await expect(family.getByRole("button", { name: "Request to claim" })).toBeEnabled();

  // Once taken down, the link stops working for families.
  await giver.goto("/give");
  await giver.getByRole("listitem").filter({ has: giver.getByRole("heading", { name }) }).getByRole("button", { name: "Take down" }).click();
  await giver.getByRole("button", { name: "Yes, take down" }).click();
  await family.reload();
  await expect(family.getByText("This item isn't available anymore.")).toBeVisible();
});
