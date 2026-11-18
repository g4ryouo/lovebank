import { describe, expect, it } from "vitest";
import { buildSettlementEntries } from "./settle";

const order = { id: "o1", giverId: "g", receiverId: "r", priceSnapshot: 300 };

describe("buildSettlementEntries", () => {
  it("兩筆:接受者 −、提供者 +,加總為 0", () => {
    const entries = buildSettlementEntries(order);
    expect(entries).toEqual([
      { userId: "r", delta: -300, reason: "order", groupId: "o1", orderId: "o1" },
      { userId: "g", delta: 300, reason: "order", groupId: "o1", orderId: "o1" },
    ]);
    expect(entries.reduce((s, e) => s + e.delta, 0)).toBe(0);
  });
  it("價格 0 → 空陣列", () => expect(buildSettlementEntries({ ...order, priceSnapshot: 0 })).toEqual([]));
  it("這次免費(0)→ 空陣列", () => expect(buildSettlementEntries(order, 0)).toEqual([]));
  it("部分金額仍加總為 0", () => {
    const e = buildSettlementEntries(order, 120);
    expect(e.map((x) => x.delta)).toEqual([-120, 120]);
  });
  it("group_id 與 order_id 皆為訂單 id", () => {
    for (const e of buildSettlementEntries(order)) {
      expect(e.groupId).toBe("o1");
      expect(e.orderId).toBe("o1");
    }
  });
  it("金額超過價格、為負或非整數 → 丟錯", () => {
    expect(() => buildSettlementEntries(order, 301)).toThrow(RangeError);
    expect(() => buildSettlementEntries(order, -1)).toThrow(RangeError);
    expect(() => buildSettlementEntries(order, 1.5)).toThrow(RangeError);
  });
});
