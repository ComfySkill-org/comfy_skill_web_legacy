import { expect, test } from "@playwright/test";

test.describe("settings logout", () => {
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Set E2E_TEST_USER_PASSWORD");

  test("tester can log out from account settings", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "tester@comfyskill.local");
    await page.fill('input[type="password"]', process.env.E2E_TEST_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/studio/);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    await page.getByTestId("settings-logout").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  });
});
