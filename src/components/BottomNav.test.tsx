import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomNavView } from "./BottomNav";

describe("BottomNavView", () => {
  it("顯示 5 個分頁與名稱", () => {
    const html = renderToStaticMarkup(<BottomNavView pathname="/" />);
    for (const label of ["首頁", "他的菜單", "邀請", "我的菜單", "設定"]) expect(html).toContain(label);
    expect((html.match(/<a /g) ?? []).length).toBe(5);
  });
  it("目前所在的分頁標示 aria-current,其他沒有", () => {
    const html = renderToStaticMarkup(<BottomNavView pathname="/orders/abc" />);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    // 亮起的那個連結就是「邀請」(/orders)
    const link = html.split("<a ").find((a) => a.includes('aria-current="page"')) ?? "";
    expect(link).toContain('href="/orders"');
  });
  it("不在導覽列的頁面(例如帳本)沒有任何分頁亮起", () => {
    expect(renderToStaticMarkup(<BottomNavView pathname="/ledger" />)).not.toContain("aria-current");
  });
  it("避開 iPhone 底部橫條", () => {
    expect(renderToStaticMarkup(<BottomNavView pathname="/" />)).toContain("safe-area-inset-bottom");
  });
});
