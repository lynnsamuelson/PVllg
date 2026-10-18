import { expect, test } from "@playwright/test";
import { signupPerson } from "./helpers.js";

// KAN-25, Mock Up 11: Home is built from the person's own answers.
test("Home welcomes a person by first name and picks something near them", async ({ page }) => {
  await signupPerson(page, { name: "Jordan Lee", zip: "37206", usage: "Both" });
  await expect(page.getByRole("heading", { level: 1, name: "Welcome, Jordan" })).toBeVisible();
  await expect(page.getByText("Lee")).toHaveCount(0);
  await expect(page.getByText("Nashville / Davidson County")).toBeVisible();

  const journey = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Your journey" }) });
  await expect(journey).toContainText("Expecting");
  await expect(journey).toContainText("Feeding");

  // One nearby item (demo data from KAN-26) and one resource that fits a need.
  await expect(page.getByText("For you right now")).toBeVisible();
  const picks = page.getByRole("link").filter({ has: page.getByRole("heading", { level: 2 }) });
  await expect(picks).toHaveCount(2);
  await expect(picks.first()).toContainText(/about \d+ miles?/i);
  await expect(picks.last()).toContainText(/Matches .+|May be a good fit/);
  await expect(page.getByText(/you qualify/i)).toHaveCount(0);

  await expect(page.getByRole("link", { name: "My items" })).toBeVisible();
  await page.getByRole("link", { name: "Find resources" }).click();
  await expect(page).toHaveURL(/\/search\?tab=resources$/);
  await page.goBack();
  await page.getByRole("link", { name: "See items" }).click();
  await expect(page).toHaveURL(/\/search$/);
});

test("with Get support off, Home leaves out the picks and Search buttons", async ({ page }) => {
  await signupPerson(page, { usage: "Give support" });
  await expect(page.getByRole("heading", { name: "Your journey" })).toBeVisible();
  await expect(page.getByText("For you right now")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Find resources" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "See items" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My items" })).toBeVisible();
});
