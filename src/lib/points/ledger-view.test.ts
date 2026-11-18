import { describe, expect, it } from "vitest";
import { computeBalance } from "./balance";
import { describeEntry, signed, toLedgerLines, type LedgerRowInput } from "./ledger-view";

let n = 0;
const row = (over: Partial<LedgerRowInput>): LedgerRowInput => ({
  id: `id${++n}`,
  delta: 100,
  reason: "allowance",
  period_key: "2026-01-02",
  note: null,
  created_at: "2026-01-02T00:00:00Z",
  orders: null,
  ...over,
});

describe("describeEntry", () => {
  it("配對禮與零用愛心", () => {
    expect(describeEntry(row({ reason: "initial" }), "小美").title).toBe("配對禮 💙");
    expect(describeEntry(row({ reason: "allowance", period_key: "2026-03-04" }), "小美")).toEqual({ title: "零用愛心", detail: "2026-03-04" });
  });
  it("訂單用快照的名稱與圖示,並說明愛心流向", () => {
    const o = { title_snapshot: "抱抱", emoji_snapshot: "🤗" };
    expect(describeEntry(row({ reason: "order", delta: -200, orders: o }), "小美")).toEqual({ title: "🤗 抱抱", detail: "送出愛心給小美" });
    expect(describeEntry(row({ reason: "order", delta: 200, orders: o }), "小美")).toEqual({ title: "🤗 抱抱", detail: "收下小美的愛心" });
  });
  it("沒有圖示就不留空白;缺少訂單資料時有備用名稱", () => {
    expect(describeEntry(row({ reason: "order", orders: { title_snapshot: "洗碗", emoji_snapshot: null } }), "他").title).toBe("洗碗");
    expect(describeEntry(row({ reason: "order", orders: null }), "他").title).toBe("小心願");
  });
  it("贈送:送出與收到,並保留備註", () => {
    expect(describeEntry(row({ reason: "gift", delta: -500, note: "謝謝你" }), "小美")).toEqual({ title: "送愛心給小美 🎁", detail: "謝謝你" });
    expect(describeEntry(row({ reason: "gift", delta: 500, note: null }), "小美").title).toBe("小美送你的愛心 🎁");
  });
  it("調整", () => expect(describeEntry(row({ reason: "adjustment", delta: -5, note: "更正" }), "他")).toEqual({ title: "愛心調整", detail: "更正" }));
  it("不使用冷冰冰的金融用語", () => {
    const all = (["initial", "allowance", "order", "gift", "adjustment"] as const).flatMap((r) => [
      describeEntry(row({ reason: r, delta: 5 }), "他"),
      describeEntry(row({ reason: r, delta: -5 }), "他"),
    ]);
    for (const d of all) expect(`${d.title}${d.detail ?? ""}`).not.toMatch(/扣款|付款|交易|餘額/);
  });
});

describe("toLedgerLines:帳本與餘額一致", () => {
  // 由舊到新:配對禮 2000、零用 500、送出愛心 −600、收到禮物 +100
  const oldestFirst = [
    row({ reason: "initial", delta: 2000 }),
    row({ reason: "allowance", delta: 500 }),
    row({ reason: "order", delta: -600, orders: { title_snapshot: "按摩", emoji_snapshot: "💆" } }),
    row({ reason: "gift", delta: 100 }),
  ];
  const newestFirst = [...oldestFirst].reverse();
  const balance = computeBalance(oldestFirst);

  it("最新一筆之後的餘額 = 目前餘額", () => {
    expect(balance).toBe(2000);
    expect(toLedgerLines(newestFirst, balance, "他")[0]?.balanceAfter).toBe(balance);
  });
  it("每一筆之後的餘額 = 當時的累計", () => {
    const lines = toLedgerLines(newestFirst, balance, "他");
    expect(lines.map((l) => l.balanceAfter)).toEqual([2000, 1900, 2500, 2000]);
  });
  it("最舊一筆之前是 0:倒推回去剛好歸零", () => {
    const lines = toLedgerLines(newestFirst, balance, "他");
    const last = lines[lines.length - 1];
    expect((last?.balanceAfter ?? 0) - (last?.delta ?? 0)).toBe(0);
  });
  it("只列出最近幾筆時,數字仍與目前餘額一致", () => {
    const recent = newestFirst.slice(0, 2);
    const lines = toLedgerLines(recent, balance, "他");
    expect(lines[0]?.balanceAfter).toBe(2000);
    expect(lines[1]?.balanceAfter).toBe(1900);
  });
  it("餘額為負也正確", () => {
    const lines = toLedgerLines([row({ delta: -300, reason: "adjustment", note: "n" })], -300, "他");
    expect(lines[0]?.balanceAfter).toBe(-300);
  });
  it("沒有任何帳 → 空", () => expect(toLedgerLines([], 0, "他")).toEqual([]));
});

describe("signed", () => {
  it("正數加 +,負數保留 −", () => {
    expect(signed(500)).toBe("+500");
    expect(signed(-200)).toBe("-200");
  });
});
