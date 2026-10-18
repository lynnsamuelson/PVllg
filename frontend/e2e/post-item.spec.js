import { expect, test } from "@playwright/test";
import { isoDate, saveOrgProfile, signupPerson, signupVerifiedOrg } from "./helpers.js";

// KAN-9, Mock Ups 19-20.
test("a person with Give support posts an item in two steps", async ({ page }) => {
  await signupPerson(page, { usage: "Give support" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Give" }).click();
  await page.getByRole("link", { name: "Post an item" }).click();
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByText("Not allowed: car seats, breastmilk, medicine, and other health-sensitive items.")).toBeVisible();

  await page.getByRole("button", { name: "Next: pickup details" }).click();
  await expect(page.getByText("Add the item name.")).toBeVisible();
  await expect(page.getByText("Check both boxes to post.")).toBeVisible();

  await page.getByLabel("Item name").fill("Wooden crib");
  await page.getByLabel("Category").selectOption({ label: "Furniture" });
  await page.getByLabel("Details").fill("Clean, all parts included.");
  await page.getByRole("checkbox", { name: "This item is in good condition" }).check();
  await page.getByRole("checkbox", { name: "I checked that it is not recalled" }).check();
  await page.getByRole("button", { name: "Next: pickup details" }).click();
  await expect(page.getByText("Step 2 of 2")).toBeVisible();

  await page.getByRole("button", { name: "Post item" }).click();
  await expect(page.getByText("Pick the pickup date.")).toBeVisible();
  await expect(page.getByText("Add the exact address.")).toBeVisible();

  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByLabel("Item name")).toHaveValue("Wooden crib");
  await page.getByRole("button", { name: "Next: pickup details" }).click();

  await page.getByLabel("Date", { exact: true }).fill(isoDate(1));
  await page.getByLabel("From", { exact: true }).fill("17:00");
  await page.getByLabel("To", { exact: true }).fill("19:00");
  await page.getByLabel("General area (shown to everyone)").fill("East Nashville");
  await page.getByLabel("Exact address (private until you approve)").fill("12 Sample Ave, Nashville");
  await page.getByRole("button", { name: "Post item" }).click();
  await expect(page.getByText("End the address with its ZIP code, like 12 Sample Ave, Nashville, TN 37206.", { exact: true })).toBeVisible();

  await page.getByLabel("Exact address (private until you approve)").fill("12 Sample Ave, Nashville, TN 37206");
  await page.getByRole("button", { name: "Post item" }).click();
  await expect(page.getByRole("status")).toHaveText("Wooden crib is posted for pickup in East Nashville.");
});

test("a person with only Get support can't post", async ({ page }) => {
  await signupPerson(page, { usage: "Get support" });
  await page.goto("/items/new");
  await expect(page.getByText("Posting items is for people with Give support on.")).toBeVisible();
  await expect(page.getByLabel("Item name")).toHaveCount(0);
});

test("a verified organization posts from its profile address, and needs one first", async ({ page }) => {
  await signupVerifiedOrg(page);
  await page.goto("/items/new");
  await page.getByLabel("Item name").fill("Stroller");
  await page.getByLabel("Category").selectOption({ label: "Furniture" });
  await page.getByLabel("Details").fill("Folds flat.");
  await page.getByRole("checkbox", { name: "This item is in good condition" }).check();
  await page.getByRole("checkbox", { name: "I checked that it is not recalled" }).check();
  await page.getByRole("button", { name: "Next: pickup details" }).click();
  await expect(page.getByText("Add your public pickup address to your organization profile first.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Post item" })).toBeDisabled();

  await saveOrgProfile(page, "100 Sample Way, Nashville, TN 37206");
  await page.goto("/items/new");
  await page.getByLabel("Item name").fill("Stroller");
  await page.getByLabel("Category").selectOption({ label: "Furniture" });
  await page.getByLabel("Details").fill("Folds flat.");
  await page.getByRole("checkbox", { name: "This item is in good condition" }).check();
  await page.getByRole("checkbox", { name: "I checked that it is not recalled" }).check();
  await page.getByRole("button", { name: "Next: pickup details" }).click();
  await expect(page.getByLabel("Public pickup address")).toHaveValue("100 Sample Way, Nashville, TN 37206");
  await expect(page.getByLabel("Exact address (private until you approve)")).toHaveCount(0);
  await page.getByLabel("Date", { exact: true }).fill(isoDate(1));
  await page.getByLabel("From", { exact: true }).fill("10:00");
  await page.getByLabel("To", { exact: true }).fill("14:00");
  await page.getByLabel("General area (shown to everyone)").fill("East Nashville");
  await page.getByRole("button", { name: "Post item" }).click();
  await expect(page.getByRole("status")).toHaveText("Stroller is posted for pickup in East Nashville.");
});
