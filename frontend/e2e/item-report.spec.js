import { expect, test } from "@playwright/test";
import { myItemId, postItem, signupPerson } from "./helpers.js";

// KAN-22, Mock Up 24.
test("a family reports a problem with an item from its page", async ({ browser }) => {
  const giver = await (await browser.newContext()).newPage();
  await signupPerson(giver, { zip: "37206", usage: "Give support" });
  const name = `Walker ${Date.now()}`;
  await postItem(giver, { name });
  const id = await myItemId(giver, "/give", name);
  await giver.goto(`/items/${id}`);
  await expect(giver.getByRole("button", { name: "Report a problem" })).toHaveCount(0);

  const page = await (await browser.newContext()).newPage();
  await signupPerson(page, { zip: "37208", usage: "Get support" });
  await page.goto(`/items/${id}`);
  const report = page.getByRole("button", { name: "Report a problem" });

  // Escape closes the sheet and focus goes back to the link that opened it.
  await report.click();
  const sheet = page.getByRole("dialog", { name: "What's wrong?" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(report).toBeFocused();

  await report.click();
  await sheet.getByRole("button", { name: "Send report" }).click();
  await expect(sheet.getByText("Pick what's wrong.")).toBeVisible();
  await sheet.getByRole("radio", { name: "Asked me to share personal information" }).check();
  await sheet.getByRole("button", { name: "Send report" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Thanks. Our team will review this.");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);

  // A report doesn't take the item down.
  await expect(page.getByRole("button", { name: "Request to claim" })).toBeEnabled();
  expect((await (await page.request.get(`/api/items/${id}/`)).json()).available).toBe(true);
});
