import { readdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const PASSWORD = "correct-horse-battery-42";
const MAIL_DIR = "../backend/e2e-mail"; // EMAIL_FILE_PATH in playwright.config.js

// The newest code emailed to `to`, from Django's file email backend.
async function latestCode(to) {
  const files = (await readdir(MAIL_DIR)).sort();
  const bodies = await Promise.all(files.map((f) => readFile(`${MAIL_DIR}/${f}`, "utf8")));
  const codes = bodies.join("\n").split(/^-{20,}$/m).filter((m) => m.includes(`To: ${to}`)).map((m) => m.match(/code is (\d{6})/)[1]);
  return codes.at(-1);
}

async function typeCode(page, code) {
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(code);
}

test("an organization confirms its domain email and becomes Verified", async ({ page }) => {
  const domain = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.org`;
  const workEmail = `hi@${domain}`;

  await page.goto("/signup?type=organization");
  await page.getByLabel("Name", { exact: true }).fill("Sample Community Closet");
  await page.getByLabel("Email", { exact: true }).fill(`lead@${domain}`);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Tell us about your organization" })).toBeVisible();

  await page.getByLabel("Website").fill(`https://www.${domain}`);
  await page.getByLabel("Work email").fill("closet@gmail.com");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText("Free email, like Gmail, can't be used to post items.")).toBeVisible();

  await page.getByLabel("Work email").fill("hi@another-site.org");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText(`Your email must end with @${domain}.`)).toBeVisible();

  await page.getByLabel("Work email").fill(workEmail);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${workEmail}.`)).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();

  // A pending organization can't reach Post an item.
  await page.goto("/items/new");
  await expect(page.getByText(/once your organization's email is confirmed/)).toBeVisible();
  await page.getByRole("link", { name: "Confirm your email" }).click();

  const code = await latestCode(workEmail);
  await typeCode(page, code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("That code isn't right. Try again.")).toBeVisible();

  await typeCode(page, code);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toHaveCount(0);

  await page.goto("/items/new");
  await expect(page.getByRole("heading", { name: "Post an item" })).toBeVisible();
  await expect(page.getByText(/once your organization's email is confirmed/)).toHaveCount(0);
});
