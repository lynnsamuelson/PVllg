import { expect, test } from "@playwright/test";
import { postItem, signupPerson } from "./helpers.js";

const tabs = (page) => page.getByRole("navigation", { name: "Main" }).getByRole("link");
const row = (page, title) => page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `Edit ${title}` }) });

// KAN-24, Mock Up 25.
test("a person edits their answers, and the changes stay after a reload", async ({ page }) => {
  await signupPerson(page, { zip: "37206", usage: "Both" });
  await page.goto("/profile");
  await expect(page.getByRole("switch", { name: "Get support" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Give support" })).toBeChecked();
  await expect(row(page, "Area")).toContainText("ZIP 37206");
  await expect(row(page, "Family stage")).toContainText("Expecting");

  await page.getByRole("button", { name: "Edit Area" }).click();
  await page.getByLabel("ZIP code (required)").fill("37208");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(row(page, "Area")).toContainText("ZIP 37208");
  await expect(page.getByText("You have changes that aren't saved yet.")).toBeVisible();

  // Parenting needs a child's age group, so saving opens that step.
  await page.getByRole("button", { name: "Edit Family stage" }).click();
  await page.getByRole("radio", { name: "Parenting" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Pick an age group for each child.")).toBeVisible();
  await page.getByRole("radio", { name: "3-12 mo" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByText("You have changes that aren't saved yet.")).toHaveCount(0);

  await page.reload();
  await expect(row(page, "Area")).toContainText("ZIP 37208");
  await expect(row(page, "Family stage")).toContainText("Parenting");
  await expect(row(page, "Children's ages")).toContainText("3-12 mo");
});

test("the switches decide the tabs, and at least one stays on", async ({ page }) => {
  await signupPerson(page, { usage: "Both" });
  await postItem(page, { name: `Bouncer ${Date.now()}` });
  await page.goto("/profile");
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Give", "Profile"]);

  // Give off: the tab goes after saving, but My items stays reachable.
  await page.getByRole("switch", { name: "Give support" }).uncheck();
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Give", "Profile"]);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(tabs(page)).toHaveText(["Home", "Search", "Claims", "Profile"]);
  await expect(page.getByRole("link", { name: "My items" })).toBeVisible();

  await page.getByRole("switch", { name: "Get support" }).click(); // refused: it's the only one on
  await expect(page.getByText("Keep at least one on.")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Get support" })).toBeChecked();

  // Turning Give back on shows the rules first.
  await page.getByRole("switch", { name: "Give support" }).click(); // waits for the rules below
  await expect(page.getByText(/Before you give:/)).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("switch", { name: "Give support" })).not.toBeChecked();
  await page.getByRole("switch", { name: "Give support" }).click(); // waits for the rules below
  await page.getByRole("button", { name: "Turn on Give support" }).click();
  await expect(page.getByRole("switch", { name: "Give support" })).toBeChecked();

  // Now Get off: Search and Claims go, and My claims stays reachable.
  await page.getByRole("switch", { name: "Get support" }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(tabs(page)).toHaveText(["Home", "Give", "Profile"]);
  await expect(page.getByRole("link", { name: "My claims" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Get support" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Give support" })).toBeChecked();
});
