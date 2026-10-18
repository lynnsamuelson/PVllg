import { expect, test } from "@playwright/test";

const PASSWORD = "correct-horse-battery-42";
const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const tabs = (page) => page.getByRole("navigation", { name: "Main" }).getByRole("link");

async function signup(page, type, name, email) {
  await page.goto("/welcome");
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByRole("radio", { name: type }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/^(Organization name|Name)$/).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
}

test("logged-out visitors see the welcome screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: "PVill" })).toBeVisible();
  await expect(page.getByText("This demo uses made-up people and organizations.")).toBeVisible();
});

test("a person signs up, gets the person tabs, signs out and back in", async ({ page }) => {
  const email = uniqueEmail();
  await signup(page, /A person/, "Ada", email);
  await expect(page).toHaveURL(/\/profile\/setup$/);
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Profile"]);

  for (const name of ["Search", "Claims", "Profile", "Home"]) {
    await tabs(page).getByText(name, { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  }

  await tabs(page).getByText("Profile", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Ada" })).toBeVisible();
});

test("an organization signs up and gets the organization tabs", async ({ page }) => {
  await signup(page, /An organization/, "Food Bank", uniqueEmail());
  await expect(page).toHaveURL(/\/org\/signup$/);
  await expect(tabs(page)).toHaveText(["Items", "Claims", "Impact", "Profile"]);

  for (const name of ["Items", "Claims", "Impact", "Profile"]) {
    await tabs(page).getByText(name, { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  }
});

test("an organization signs back in to its Items tab, and / sends it there too", async ({ page }) => {
  const email = uniqueEmail();
  await signup(page, /An organization/, "Food Bank", email);
  await tabs(page).getByText("Profile", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/org\/items$/);
  await expect(page.getByRole("heading", { name: "My items" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/org\/items$/);
  await expect(tabs(page)).toHaveText(["Items", "Claims", "Impact", "Profile"]);
});

test("signing up with a used email says what went wrong", async ({ page }) => {
  const email = uniqueEmail();
  await signup(page, /A person/, "Ada", email);
  await tabs(page).getByText("Profile", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  await signup(page, /A person/, "Ada", email);
  await expect(page.getByText("An account with this email already exists.")).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});
