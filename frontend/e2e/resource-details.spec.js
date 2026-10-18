import { expect, test } from "@playwright/test";
import { signupPerson } from "./helpers.js";

const result = (page, name) => page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) });

// KAN-18, Mock Up 22.
test("a family opens a resource from search and goes back to the same results", async ({ page }) => {
  await signupPerson(page, { zip: "37206", usage: "Get support" });
  await page.goto("/search?tab=resources&radius=50");
  await result(page, "Nashville Diaper Connection").click();

  await expect(page.getByRole("heading", { level: 1, name: "Nashville Diaper Connection" })).toBeVisible();
  await expect(page.getByText("Public listing", { exact: true })).toBeVisible();
  for (const card of ["What it offers", "Who may be a good fit", "Next step", "Contact"]) {
    await expect(page.getByRole("heading", { level: 2, name: card })).toBeVisible();
  }
  await expect(page.getByText(/last checked Oct 17, 2026\. Please confirm before you go\.$/)).toBeVisible();
  await expect(page.getByText(/you qualify/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Reach out/ })).toBeVisible();

  await page.getByRole("button", { name: "← Results" }).click();
  await expect(page).toHaveURL(/\/search\?tab=resources&radius=50$/);
  await expect(page.getByRole("tab", { name: "Resources" })).toHaveAttribute("aria-selected", "true");
});

test("an unknown resource says it wasn't found", async ({ page }) => {
  await signupPerson(page);
  await page.goto("/resources/99999");
  await expect(page.getByRole("heading", { level: 1, name: "Resource not found" })).toBeVisible();
});

// KAN-21, Mock Up 23: a demo only. Nothing is sent and nothing is collected.
test("Reach out shows the demo sheet and sends nothing", async ({ page }) => {
  await signupPerson(page, { zip: "37206", usage: "Get support" });
  await page.goto("/search?tab=resources&radius=50");
  await result(page, "Nashville Diaper Connection").click();
  await expect(page.getByRole("heading", { level: 1, name: "Nashville Diaper Connection" })).toBeVisible();

  const sent = [];
  page.on("request", (r) => r.method() !== "GET" && sent.push(r.url()));
  await page.getByRole("button", { name: /Reach out/ }).click();
  const sheet = page.getByRole("dialog", { name: "No request will be sent" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Demo only", { exact: true })).toBeVisible();
  await expect(sheet).toContainText("no message is sent and no personal details are collected.");
  await expect(sheet.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText(/Request sent/i)).toHaveCount(0);

  await sheet.getByRole("button", { name: "Back to details" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Nashville Diaper Connection" })).toBeVisible();
  expect(sent).toEqual([]);
});
