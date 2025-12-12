import { expect, test } from "@playwright/test";

/**
 * E2E: studio deep links select the requested project block after hydrate.
 */
test.describe("studio deeplink", () => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Set E2E_TEST_USER_PASSWORD");

  test("project and block query params select the target block", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "tester@comfyskill.local");
    await page.fill('input[type="password"]', process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/studio/);

    await expect(page.getByTestId("studio-sync-label")).toHaveText(/saved|cloud/i, {
      timeout: 30_000,
    });

    const projectId = new URL(page.url()).searchParams.get("project");
    test.skip(!projectId, "Cloud project id not available after sync");

    const blockId = await page.locator("[data-block-id]").first().getAttribute("data-block-id");
    test.skip(!blockId, "Starter block id not found");

    await page.goto(`/studio?project=${projectId}&block=${blockId}`);
    await expect(page.getByTestId("studio-block-selected")).toBeVisible();
    await expect(page.getByTestId("studio-block-selected")).toContainText("Shot A");
  });
});
