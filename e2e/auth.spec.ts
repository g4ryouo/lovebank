import { expect, test } from "@playwright/test";

// 不需要任何登入憑證的流程。兩個真實帳號配對的完整流程需要 LINE 登入,見 docs/TASKS.md T4 備註。
test.describe("登入保護與 LINE 登入入口", () => {
  test("未登入開首頁或配對頁,會被帶到登入頁", async ({ page }) => {
    for (const path of ["/", "/pair", "/menu", "/partner", "/orders", "/settings", "/proposals", "/help", "/ledger", "/orders/11111111-1111-4111-8111-111111111111"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { name: "愛愛銀行" })).toBeVisible();
  });

  test("登入頁有個資說明,並可展開看保存了哪些資料", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("只用來記錄你們的愛心進度")).toBeVisible();
    await page.getByText("我們會保存哪些資料?").click();
    await expect(page.getByText("LINE 提供的名稱與大頭貼")).toBeVisible();
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
    await expect(page.getByText("登入沒有成功,再試一次吧")).toBeVisible();
  });

  test("auth/callback 沒帶 code 時回到登入頁並提示", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=auth/);
  });

  test("next 參數不能導去外部網站", async ({ page }) => {
    await page.goto("/auth/callback?next=https://evil.example");
    await expect(page).toHaveURL(/localhost:3000\/login/);
  });

  test("API:沒登入不能用小幫手與提案", async ({ request }) => {
    for (const url of ["/api/support", "/api/proposals", "/api/proposals/11111111-1111-4111-8111-111111111111/counter"]) {
      const res = await request.post(url, { data: { messages: [{ role: "user", content: "hi" }] } });
      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe("請先登入喔");
    }
  });
});

test.describe("手機與 PWA 設定", () => {
  test("manifest 可讀取,名稱與全螢幕設定正確", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toBe("愛愛銀行");
    expect(m.display).toBe("standalone");
    expect(m.icons.length).toBeGreaterThanOrEqual(3);
  });

  test("manifest 裡的圖示都能下載且是 PNG", async ({ request }) => {
    const m = await (await request.get("/manifest.webmanifest")).json();
    for (const icon of m.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
  });

  test("網頁標頭:主畫面圖示、全螢幕、主題色、避開瀏海", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "愛愛銀行");
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#f3f9ff");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  });

  test("登入頁沒有底部導覽列", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("navigation", { name: "主要導覽" })).toHaveCount(0);
  });

  test("手機寬度不會左右捲動", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/login");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
