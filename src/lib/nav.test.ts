import { describe, expect, it } from "vitest";
import { NAV_ITEMS, activeTab, showNav } from "./nav";

describe("showNav", () => {
  it("遊戲內的頁面顯示", () => {
    for (const p of ["/", "/partner", "/orders", "/orders/abc", "/menu", "/settings", "/ledger", "/proposals"]) expect(showNav(p)).toBe(true);
  });
  it("登入、配對、小幫手、驗證回呼不顯示", () => {
    for (const p of ["/login", "/login?error=auth", "/pair", "/help", "/auth/callback"]) expect(showNav(p.split("?")[0] ?? p)).toBe(false);
  });
  it("名稱相近的頁面不會被誤判", () => {
    expect(showNav("/helpful")).toBe(true);
    expect(showNav("/pairing-tips")).toBe(true);
  });
});

describe("activeTab", () => {
  it("首頁只有在 / 時亮起", () => {
    expect(activeTab("/")).toBe("/");
    expect(activeTab("/ledger")).toBeNull();
  });
  it("子頁面歸在所屬分頁", () => {
    expect(activeTab("/orders")).toBe("/orders");
    expect(activeTab("/orders/123")).toBe("/orders");
    expect(activeTab("/partner")).toBe("/partner");
  });
  it("不在導覽列的頁面沒有亮起的分頁", () => {
    for (const p of ["/proposals", "/ledger", "/help"]) expect(activeTab(p)).toBeNull();
  });
});

describe("NAV_ITEMS", () => {
  it("5 個分頁、網址不重複、名稱溫暖不冰冷", () => {
    expect(NAV_ITEMS).toHaveLength(5);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(5);
    for (const i of NAV_ITEMS) expect(i.label).not.toMatch(/訂單|交易|付款/);
  });
});
