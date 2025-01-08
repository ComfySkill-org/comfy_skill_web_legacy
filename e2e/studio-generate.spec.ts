import { expect, test } from "@playwright/test";

/**
 * E2E: login → studio canvas → generate from Skill template block.
 *
 * Requires:
 * - Frontend at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 * - API at NEXT_PUBLIC_API_URL with COMFYUI_MOCK=true or real ComfyUI
 * - Seed account tester@comfyskill.local
 */
test.describe("studio generate", () => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Set E2E_TEST_USER_PASSWORD");

  test("tester can generate image from studio block", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "tester@comfyskill.local");
    await page.fill('input[type="password"]', process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/studio/);

    await page.getByTestId("studio-skill-pixar-short").click();
    await expect(page.getByTestId("studio-block-status")).toBeVisible();

    await page.getByTestId("studio-generate").click();

    await expect(page.getByTestId("studio-block-status")).toHaveText(/completed/i, {
      timeout: 120_000,
    });
    await expect(page.getByTestId("studio-block-media")).toBeVisible();
  });
});
