import { expect, test } from "@playwright/test";
import { postItem, signupPerson, signupVerifiedOrg } from "./helpers.js";

const result = (page, name) => page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) });

// KAN-15, Mock Up 12.
test("a family searches nearby items and resources, and the search stays in the URL", async ({ browser }) => {
  const giver = await (await browser.newContext()).newPage();
  await signupPerson(giver, { name: "Jordan Lee", zip: "37206", usage: "Give support" });
  const crib = `Crib ${Date.now()}`;
  await postItem(giver, { name: crib, address: "12 Sample Ave, Nashville, TN 37206" });

  const page = await (await browser.newContext()).newPage();
  await signupPerson(page, { name: "Taylor Kim", zip: "37208", usage: "Get support" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Search" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Items" })).toHaveAttribute("aria-selected", "true");

  // Made-up data from KAN-26 carries the Demo badge.
  await expect(result(page, "Size 1 diapers")).toContainText("Verified");
  await expect(result(page, "Size 1 diapers")).toContainText("Demo");
  await expect(result(page, "Size 1 diapers")).toContainText(/About \d+ miles? · \d+ left/);

  await page.getByRole("searchbox", { name: "Search" }).fill(crib);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(crib).replace(/%20/g, "\\+")}`));
  await expect(page.getByRole("list").getByRole("link")).toHaveCount(1);
  await expect(result(page, crib)).toContainText("A parent nearby");
  await expect(result(page, crib)).toContainText("Person");
  await expect(result(page, crib)).not.toContainText("Jordan");

  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue(crib);
  await expect(result(page, crib)).toBeVisible();

  await page.getByRole("searchbox", { name: "Search" }).fill("");
  await page.getByRole("radio", { name: "Housing" }).click();
  await expect(page.getByText("Housing help is listed under Resources.")).toBeVisible();
  await page.getByRole("button", { name: "See housing resources" }).click();
  await expect(page.getByRole("tab", { name: "Resources" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list").getByRole("link").first()).toBeVisible();
});

test("an empty search offers a wider distance", async ({ page }) => {
  await signupPerson(page, { zip: "37206", usage: "Get support" });
  await page.goto(`/search?q=nothing-matches-${Date.now()}`);
  await expect(page.getByText("Nothing found within 10 miles. Try a wider distance or fewer filters.")).toBeVisible();
  await page.getByRole("button", { name: "Search within 25 miles" }).click();
  await expect(page).toHaveURL(/radius=25/);
  await expect(page.getByText("Nothing found within 25 miles. Try a wider distance or fewer filters.")).toBeVisible();
});

test("organizations are told Search is for families", async ({ page }) => {
  await signupVerifiedOrg(page);
  await page.goto("/search");
  await expect(page.getByText("Search near me is for families looking for items and resources.")).toBeVisible();
});
