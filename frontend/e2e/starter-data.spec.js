import { expect, test } from "@playwright/test";
import { PASSWORD, signupPerson } from "./helpers.js";

// KAN-26: the 12 starter resources replace the placeholders, and demo accounts can't be signed into.
test("a person sees the starter resources on Home, with their details", async ({ page }) => {
  await signupPerson(page);
  const resources = page.getByRole("heading", { level: 3 });
  await expect(resources).toHaveCount(12);
  await expect(page.getByRole("link", { name: "Getting started guide" })).toHaveCount(0);

  await page.getByRole("link", { name: "Foster Families Assistance Network (FFAN)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Foster Families Assistance Network (FFAN)" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("link", { name: "MySimilac Rewards" })).toBeVisible();
  await expect(page.getByText(/It is not free formula\./)).toBeVisible();
});

test("demo accounts have no usable password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("taylor@demo.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
