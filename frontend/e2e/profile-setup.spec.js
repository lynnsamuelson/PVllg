import { expect, test } from "@playwright/test";

const PASSWORD = "correct-horse-battery-42";
const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const tabs = (page) => page.getByRole("navigation", { name: "Main" }).getByRole("link");

async function signupAsPerson(page, email) {
  await page.goto("/welcome");
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByRole("radio", { name: /A person/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ada");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/profile\/setup$/);
}

test("a person finishes the 4 profile steps, and the answers stay after signing back in", async ({ page }) => {
  const email = uniqueEmail();
  await signupAsPerson(page, email);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Enter your 5-digit ZIP code.")).toBeVisible();
  await page.getByLabel("ZIP code (required)").fill("37206");
  await page.getByRole("radio", { name: "Parenting" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByRole("radio", { name: "1-2 yrs" }).click();
  await page.getByRole("checkbox", { name: "Kinship caregiver" }).check();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("checkbox", { name: "Food & feeding support" }).check();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByRole("checkbox", { name: "Kinship caregiver" })).toBeChecked();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("checkbox", { name: "Food & feeding support" })).toBeChecked();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("radio", { name: /Both/ }).click();
  await page.getByRole("button", { name: "Finish my profile" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Give", "Profile"]);

  await tabs(page).getByText("Profile", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Give", "Profile"]);

  const me = await (await page.request.get("/api/auth/me/")).json();
  expect(me.user.profile).toEqual({
    zip: "37206",
    area: "Nashville / Davidson County",
    stage: "parenting",
    arrival_month: "",
    ages: ["1_2yrs"],
    roles: ["kinship"],
    needs: ["feeding"],
    usage: "both",
  });
});

test("a person who only gets support has no Give tab", async ({ page }) => {
  await signupAsPerson(page, uniqueEmail());
  await page.getByLabel("ZIP code (required)").fill("37206");
  await page.getByRole("radio", { name: "Expecting" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("checkbox", { name: "Housing & family stability" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Get support/ }).click();
  await page.getByRole("button", { name: "Finish my profile" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Profile"]);
});
