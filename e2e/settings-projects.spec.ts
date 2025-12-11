import { expect, test } from "@playwright/test";

test.describe("settings projects", () => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Set E2E_TEST_USER_PASSWORD");

  test("tester can open a cloud project from account settings", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "tester@comfyskill.local");
    await page.fill('input[type="password"]', process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/studio/);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    const projectRow = page.getByTestId("settings-project-row").first();
    const rowCount = await page.getByTestId("settings-project-row").count();
    test.skip(rowCount === 0, "No cloud projects for tester account");

    await projectRow.getByRole("link", { name: /open/i }).click();
    await expect(page).toHaveURL(/\/studio\?project=/);
    await expect(page.getByTestId("studio-canvas-stats")).toBeVisible();
  });
});
