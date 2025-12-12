import { expect, test } from "@playwright/test";

/**
 * E2E: studio canvas blocks and links survive a full page reload after cloud sync.
 */
test.describe("studio persist", () => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Set E2E_TEST_USER_PASSWORD");

  test("starter canvas layout restores after reload", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "tester@comfyskill.local");
    await page.fill('input[type="password"]', process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/studio/);

    await expect(page.getByText("Shot A")).toBeVisible();
    await expect(page.getByText("Shot B")).toBeVisible();
    await expect(page.getByTestId("studio-canvas-stats")).toHaveText(/2 blocks · 1 link/);

    await expect(page.getByTestId("studio-sync-label")).toHaveText(/saved|cloud/i, {
      timeout: 30_000,
    });

    const urlBeforeReload = page.url();
    await page.reload();

    await expect(page).toHaveURL(/\/studio/);
    if (urlBeforeReload.includes("project=")) {
      await expect(page).toHaveURL(/project=/);
    }

    await expect(page.getByText("Shot A")).toBeVisible();
    await expect(page.getByText("Shot B")).toBeVisible();
    await expect(page.getByTestId("studio-canvas-stats")).toHaveText(/2 blocks · 1 link/);
  });
});
