import { expect, test } from "@playwright/test";
import { myItemId, postItem, saveOrgProfile, signupPerson, signupVerifiedOrg } from "./helpers.js";

const card = (page, name) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });

// KAN-10, Mock Up 21.
test("a giver sees, edits and takes down their items", async ({ page }) => {
  await signupPerson(page, { usage: "Both" });
  await page.goto("/give");
  await expect(page.getByText(/You haven't posted anything yet/)).toBeVisible();

  await postItem(page, { name: "High chair", quantity: 2 });
  await page.getByRole("link", { name: "My items" }).click();
  await expect(card(page, "High chair")).toContainText("2 left");

  await card(page, "High chair").getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await expect(page.getByLabel("Item name")).toHaveValue("High chair");
  await page.getByLabel("How many?").fill("3");
  await page.getByRole("button", { name: "Next: pickup details" }).click();
  await page.getByLabel("General area (shown to everyone)").fill("Inglewood");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved High chair.")).toBeVisible();
  await expect(card(page, "High chair")).toContainText("3 left");

  await page.reload();
  await expect(page.getByText("Saved High chair.")).toHaveCount(0);

  await card(page, "High chair").getByRole("button", { name: "Take down" }).click();
  await expect(page.getByText("Are you sure? Families won't find High chair anymore.")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(card(page, "High chair")).toBeVisible();

  await card(page, "High chair").getByRole("button", { name: "Take down" }).click();
  await page.getByRole("button", { name: "Yes, take down" }).click();
  await expect(card(page, "High chair")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/You haven't posted anything yet/)).toBeVisible();
});

test("an organization's items follow a new profile address", async ({ page }) => {
  await signupVerifiedOrg(page);
  await saveOrgProfile(page, "100 Sample Way, Nashville, TN 37206");
  await postItem(page, { name: "Diaper boxes" });
  await page.getByRole("link", { name: "My items" }).click();
  await expect(page).toHaveURL(/\/org\/items$/);
  await expect(card(page, "Diaper boxes")).toContainText("1 left");

  await saveOrgProfile(page, "200 Other Rd, Nashville, TN 37208");
  const id = await myItemId(page, "/org/items", "Diaper boxes");
  const item = await (await page.request.get(`/api/items/${id}/`)).json();
  expect(item.exact_address).toBe("200 Other Rd, Nashville, TN 37208");
});
