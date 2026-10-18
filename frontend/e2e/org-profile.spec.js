import { expect, test } from "@playwright/test";
import { signupPerson, signupVerifiedOrg } from "./helpers.js";

// KAN-8, Mock Up 9.
test("a verified organization sets up its profile and finds it again from the Profile tab", async ({ page }) => {
  await signupVerifiedOrg(page);
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/org\/profile$/);
  await expect(page.getByText("Sample Community Closet")).toBeVisible();

  await page.getByLabel("About us").fill("We share baby clothes with families in Davidson County.");
  await page.getByRole("checkbox", { name: "New parents" }).click();
  await page.getByRole("checkbox", { name: "Foster families" }).click();
  await page.getByLabel("Public pickup address").fill("123 Example St, Nashville");
  await page.getByLabel("Public contact").fill("info@samplecommunitycloset.org");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("End the address with its ZIP code, like 123 Example St, Nashville, TN 37206.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("About us")).toHaveValue("We share baby clothes with families in Davidson County.");

  await page.getByLabel("Public pickup address").fill("123 Example St, Nashville, TN 37206");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByLabel("Public contact").fill("call us");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Enter an email or phone number.")).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("link", { name: "Organization profile" }).click();
  await expect(page.getByLabel("Public pickup address")).toHaveValue("123 Example St, Nashville, TN 37206");
  await expect(page.getByLabel("Public contact")).toHaveValue("info@samplecommunitycloset.org");
  await expect(page.getByRole("checkbox", { name: "New parents" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Foster families" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Kinship caregivers" })).not.toBeChecked();
});

test("a person can't open the organization profile", async ({ page }) => {
  await signupPerson(page);
  await page.goto("/org/profile");
  await expect(page.getByText("Only verified organizations have this profile.")).toBeVisible();
  await expect(page.getByLabel("Public pickup address")).toHaveCount(0);
});
