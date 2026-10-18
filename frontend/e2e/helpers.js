import { readdir, readFile } from "node:fs/promises";
import { expect } from "@playwright/test";

export const PASSWORD = "correct-horse-battery-42";
const MAIL_DIR = "../backend/e2e-mail"; // EMAIL_FILE_PATH in playwright.config.js

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const uniqueEmail = () => `e2e-${unique()}@example.com`;

// YYYY-MM-DD for `days` from today, in the browser's local time (what <input type="date"> takes).
export function isoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Today in Nashville (YYYY-MM-DD), the day the backend checks pickup dates against.
export const nashvilleToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

async function signup(page, { name, email, type }) {
  await page.goto(`/signup?type=${type}`);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
}

// Signs up a person and answers the 4 profile steps. usage: "Get support", "Give support" or "Both".
export async function signupPerson(page, { name = "Jordan Lee", zip = "37206", usage = "Both" } = {}) {
  const email = uniqueEmail();
  await signup(page, { name, email, type: "person" });
  await expect(page).toHaveURL(/\/profile\/setup$/);
  await page.getByLabel("ZIP code (required)").fill(zip);
  await page.getByRole("radio", { name: "Expecting" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("checkbox", { name: "Food & feeding support" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: new RegExp(`^${usage}`) }).click();
  await page.getByRole("button", { name: "Finish my profile" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

// The newest code emailed to `to`, from Django's file email backend.
export async function latestCode(to) {
  const files = (await readdir(MAIL_DIR)).sort();
  const bodies = await Promise.all(files.map((f) => readFile(`${MAIL_DIR}/${f}`, "utf8")));
  const codes = bodies.join("\n").split(/^-{20,}$/m).filter((m) => m.includes(`To: ${to}`)).map((m) => m.match(/code is (\d{6})/)[1]);
  return codes.at(-1);
}

export async function typeCode(page, code) {
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(code);
}

// Signs up an organization and confirms its work email, ending on "Email confirmed".
export async function signupVerifiedOrg(page, { name = "Sample Community Closet" } = {}) {
  const domain = `e2e-${unique()}.org`;
  const workEmail = `hi@${domain}`;
  await signup(page, { name, email: `lead@${domain}`, type: "organization" });
  await page.getByLabel("Website").fill(`https://www.${domain}`);
  await page.getByLabel("Work email").fill(workEmail);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${workEmail}.`)).toBeVisible();
  await typeCode(page, await latestCode(workEmail));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  return { domain, name };
}

export async function saveOrgProfile(page, address = "100 Sample Way, Nashville, TN 37206") {
  await page.goto("/org/profile");
  await page.getByLabel("Public pickup address").fill(address);
  await page.getByLabel("Public contact").fill("info@example.org");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
}

// A 1x1 PNG, for posting an item with a photo.
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==", "base64");

// Posts an item through both steps and checks the Posted screen. Organizations have no exact address.
export async function postItem(page, { name, quantity = 1, area = "East Nashville", address = "12 Sample Ave, Nashville, TN 37206", photo = false, date = isoDate(1) }) {
  await page.goto("/items/new");
  await page.getByLabel("Item name").fill(name);
  await page.getByLabel("Category").selectOption({ label: "Furniture" });
  await page.getByLabel("Details").fill("Clean, all parts included.");
  await page.getByLabel("How many?").fill(String(quantity));
  if (photo) await page.getByLabel("Photos (add up to 4)").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("checkbox", { name: "This item is in good condition" }).check();
  await page.getByRole("checkbox", { name: "I checked that it is not recalled" }).check();
  await page.getByRole("button", { name: "Next: pickup details" }).click();
  await page.getByLabel("Date", { exact: true }).fill(date);
  await page.getByLabel("From", { exact: true }).fill("17:00");
  await page.getByLabel("To", { exact: true }).fill("19:00");
  await page.getByLabel("General area (shown to everyone)").fill(area);
  const exact = page.getByLabel("Exact address (private until you approve)");
  if (await exact.count()) await exact.fill(address);
  await page.getByRole("button", { name: "Post item" }).click();
  await expect(page.getByRole("status")).toHaveText(`${name} is posted for pickup in ${area}.`);
}

// The id of one of the signed-in giver's items, read from its Edit link on My items.
export async function myItemId(page, listPath, name) {
  await page.goto(listPath);
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
  const href = await card.getByRole("link", { name: "Edit" }).getAttribute("href");
  return href.match(/\/items\/(\d+)\/edit/)[1];
}

// Claims an item from its details page and lands on My claims.
export async function claimItem(page, id) {
  await page.goto(`/items/${id}`);
  await page.getByRole("button", { name: /^(Claim one \(held for 3 days\)|Request to claim)$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My claims" })).toBeVisible();
}
