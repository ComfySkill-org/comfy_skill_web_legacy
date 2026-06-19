import { expect, test } from "@playwright/test";

/**
 * E2E-001: tester text → image (Milestone 0)
 *
 * Requires:
 * - Frontend at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 * - API at NEXT_PUBLIC_API_URL with COMFYUI_MOCK=true or real ComfyUI
 * - Seed account tester@comfyskill.local
 */
test.describe("text to image", () => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Set E2E_TEST_USER_PASSWORD");

  test("tester can generate image from text", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "tester@comfyskill.local");
    await page.fill('input[type="password"]', process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);

    await page.getByTestId("prompt").fill("a cat on the moon, cinematic");
    await page.getByTestId("quality-standard").click();
    await page.getByTestId("generate").click();

    await expect(page.getByTestId("job-status")).toHaveText(/completed/i, {
      timeout: 120_000,
    });
    await expect(page.getByTestId("output-image")).toBeVisible();
  });
});
