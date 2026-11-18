import { describe, expect, it } from "vitest";
import { availableOrderActions, toOrderLike } from "./order-actions";
import type { OrderLike, OrderStatus } from "./types";

const G = "giver";
const R = "receiver";
const NOW = new Date("2026-01-10T12:00:00Z");
const FUTURE = new Date("2026-01-12T12:00:00Z");

function order(status: OrderStatus, initiatedBy = R, expiresAt: Date | null = FUTURE): OrderLike {
  return { id: "o", status, giverId: G, receiverId: R, initiatedBy, priceSnapshot: 100, autoConfirmAt: null, expiresAt };
}
const acts = (o: OrderLike, who: string, now = NOW) => availableOrderActions(o, who, now);

describe("requested", () => {
  it("接受者發起:提供者可接受/婉拒,接受者只能取消", () => {
    const o = order("requested", R);
    expect(acts(o, G)).toEqual(["accept", "decline"]);
    expect(acts(o, R)).toEqual(["cancel"]);
  });
  it("提供者發起:接受者可接受/婉拒,提供者只能取消", () => {
    const o = order("requested", G);
    expect(acts(o, R)).toEqual(["accept", "decline"]);
    expect(acts(o, G)).toEqual(["cancel"]);
  });
  it("逾期後沒有任何按鈕(等系統標為過期)", () => {
    const o = order("requested", R, new Date(NOW.getTime() - 1));
    expect(acts(o, G)).toEqual([]);
    expect(acts(o, R)).toEqual([]);
  });
});

describe("accepted", () => {
  it("提供者:做完了、這次免費、取消", () => expect(acts(order("accepted"), G)).toEqual(["mark_done", "waive", "cancel"]));
  it("接受者:只能取消", () => expect(acts(order("accepted"), R)).toEqual(["cancel"]));
});

describe("done_by_giver", () => {
  it("接受者:確認", () => expect(acts(order("done_by_giver"), R)).toEqual(["confirm"]));
  it("提供者:這次免費(不能自己確認)", () => expect(acts(order("done_by_giver"), G)).toEqual(["waive"]));
});

describe("終態與外人", () => {
  it("完成、婉拒、取消、過期都沒有按鈕", () => {
    for (const s of ["completed", "declined", "cancelled", "expired"] as const) {
      expect(acts(order(s), G)).toEqual([]);
      expect(acts(order(s), R)).toEqual([]);
    }
  });
  it("外人沒有任何按鈕", () => {
    for (const s of ["requested", "accepted", "done_by_giver", "completed"] as const) {
      expect(acts(order(s), "stranger")).toEqual([]);
    }
  });
});

describe("toOrderLike", () => {
  it("轉換欄位與日期", () => {
    const o = toOrderLike({
      id: "x",
      status: "accepted",
      giver_id: G,
      receiver_id: R,
      initiated_by: R,
      price_snapshot: 5,
      auto_confirm_at: "2026-01-11T00:00:00Z",
      expires_at: null,
    });
    expect(o).toMatchObject({ giverId: G, receiverId: R, initiatedBy: R, priceSnapshot: 5, expiresAt: null });
    expect(o.autoConfirmAt?.toISOString()).toBe("2026-01-11T00:00:00.000Z");
  });
});
