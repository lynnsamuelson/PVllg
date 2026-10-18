import { expect, test } from "@playwright/test";
import { PASSWORD, signupPerson } from "./helpers.js";

// KAN-26: the 12 starter resources replace the placeholders, and demo accounts can't be signed into.
// (Home stopped listing every resource in KAN-25, so this reads the list and opens resource pages directly.)
test("the 12 starter resources replace the placeholders, with their details", async ({ page }) => {
  await signupPerson(page);
  const resources = await (await page.request.get("/api/resources/")).json();
  const titles = resources.map((r) => r.title);
  expect(titles).toHaveLength(12);
  expect(titles).not.toContain("Getting started guide");

  const id = (title) => resources.find((r) => r.title === title).id;
  await page.goto(`/resources/${id("Foster Families Assistance Network (FFAN)")}`);
  await expect(page.getByRole("heading", { level: 1, name: "Foster Families Assistance Network (FFAN)" })).toBeVisible();
  await page.goto(`/resources/${id("MySimilac Rewards")}`);
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
