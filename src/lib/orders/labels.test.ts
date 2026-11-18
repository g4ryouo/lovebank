import { describe, expect, it } from "vitest";
import { groupOf, heartText, statusLabel, whoText, type LabelOrder } from "./labels";

const G = "g";
const R = "r";
const o = (over: Partial<LabelOrder> = {}): LabelOrder => ({
  status: "requested",
  giver_id: G,
  receiver_id: R,
  initiated_by: R,
  price_snapshot: 200,
  settled_amount: null,
  ...over,
});

describe("groupOf", () => {
  it("requested:回應者在『等我回應』,發起者在『進行中』", () => {
    expect(groupOf(o({ initiated_by: R }), G)).toBe("waiting-me");
    expect(groupOf(o({ initiated_by: R }), R)).toBe("ongoing");
  });
  it("done_by_giver:接受者在『等我回應』(要確認),提供者在『進行中』", () => {
    expect(groupOf(o({ status: "done_by_giver" }), R)).toBe("waiting-me");
    expect(groupOf(o({ status: "done_by_giver" }), G)).toBe("ongoing");
  });
  it("accepted 為進行中;終態為已結束", () => {
    expect(groupOf(o({ status: "accepted" }), G)).toBe("ongoing");
    for (const s of ["completed", "declined", "cancelled", "expired"] as const) expect(groupOf(o({ status: s }), G)).toBe("done");
  });
});

describe("statusLabel", () => {
  it("等待中的說法", () => {
    expect(statusLabel(o(), R, "小美")).toBe("等小美回應");
    expect(statusLabel(o(), G, "小明")).toBe("等你回應");
    expect(statusLabel(o({ status: "done_by_giver" }), R, "小美")).toBe("小美做完了,等你確認");
    expect(statusLabel(o({ status: "done_by_giver" }), G, "小明")).toBe("等小明確認");
  });
  it("完成與免費", () => {
    expect(statusLabel(o({ status: "completed", settled_amount: 200 }), G, "x")).toBe("完成了 💙");
    expect(statusLabel(o({ status: "completed", settled_amount: 0 }), G, "x")).toBe("完成了 💙 這次免費");
  });
  it("婉拒、取消、過期的說法不帶責備", () => {
    expect(statusLabel(o({ status: "declined" }), G, "x")).toBe("婉拒了");
    expect(statusLabel(o({ status: "cancelled" }), G, "x")).toBe("已取消");
    expect(statusLabel(o({ status: "expired" }), G, "x")).toBe("沒有回應,已過期");
  });
  it("不使用冷冰冰的金融用語", () => {
    const all = (["requested", "accepted", "done_by_giver", "completed", "declined", "cancelled", "expired"] as const).flatMap((s) => [
      statusLabel(o({ status: s }), G, "他"),
      statusLabel(o({ status: s }), R, "他"),
    ]);
    for (const t of all) expect(t).not.toMatch(/扣款|付款|交易|拒絕|餘額不足/);
  });
});

describe("whoText / heartText", () => {
  it("誰請誰", () => {
    expect(whoText(o(), G, "小明")).toBe("小明想請你做");
    expect(whoText(o(), R, "小美")).toBe("你想請小美做");
  });
  it("愛心流向", () => {
    expect(heartText(o(), G)).toBe("完成後你會收下 200 愛心");
    expect(heartText(o(), R)).toBe("完成後你會送出 200 愛心");
    expect(heartText(o({ status: "completed", settled_amount: 200 }), G)).toBe("收下了 200 愛心");
    expect(heartText(o({ status: "completed", settled_amount: 200 }), R)).toBe("送出了 200 愛心");
  });
  it("價格 0 或這次免費都顯示免費", () => {
    expect(heartText(o({ price_snapshot: 0 }), G)).toBe("免費");
    expect(heartText(o({ status: "completed", settled_amount: 0 }), R)).toBe("免費");
  });
});
