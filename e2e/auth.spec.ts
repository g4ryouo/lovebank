import { expect, test } from "@playwright/test";

// 不需要任何登入憑證的流程。兩個真實帳號配對的完整流程需要 LINE 登入,見 docs/TASKS.md T4 備註。
test.describe("登入保護與 LINE 登入入口", () => {
  test("未登入開首頁或配對頁,會被帶到登入頁", async ({ page }) => {
    for (const path of ["/", "/pair", "/menu", "/partner"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { name: "愛愛銀行" })).toBeVisible();
  });

  test("登入頁標題是愛愛銀行", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("愛愛銀行");
  });

  test("按下「用 LINE 登入」會整頁跳到 LINE 的登入頁", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "用 LINE 登入" }).click();
    await page.waitForURL(/access\.line\.me/, { timeout: 30_000 });
    await expect(page).toHaveTitle("LINE Login");
  });

  test("登入失敗時顯示溫暖的訊息", async ({ page }) => {
    await page.goto("/login?error=auth");
    await expect(page.getByRole("alert")).toHaveText("登入沒有成功,再試一次吧");
  });

  test("auth/callback 沒帶 code 時回到登入頁並提示", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=auth/);
  });

  test("next 參數不能導去外部網站", async ({ page }) => {
    await page.goto("/auth/callback?next=https://evil.example");
    await expect(page).toHaveURL(/localhost:3000\/login/);
  });
});
