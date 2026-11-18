import { describe, expect, it } from "vitest";
import { canTransition, roleOf } from "./order-state";
import { ORDER_STATUSES, type Actor, type OrderAction, type OrderLike, type OrderStatus } from "./types";

const G = "giver";
const R = "receiver";
const X = "stranger";
const NOW = new Date("2026-01-10T12:00:00Z");

const user = (id: string): Actor => ({ type: "user", id });
const SYSTEM: Actor = { type: "system" };

function order(status: OrderStatus, initiatedBy = R, autoConfirmAt: Date | null = null): OrderLike {
  return { id: "o1", status, giverId: G, receiverId: R, initiatedBy, priceSnapshot: 100, autoConfirmAt };
}
const run = (status: OrderStatus, action: OrderAction, actor: Actor, o = order(status), now = NOW) =>
  canTransition(status, action, actor, o, now);

describe("roleOf", () => {
  it("辨認角色", () => {
    expect(roleOf(G, order("requested"))).toBe("giver");
    expect(roleOf(R, order("requested"))).toBe("receiver");
    expect(roleOf(X, order("requested"))).toBeNull();
  });
});

describe("合法路徑", () => {
  it("接受者發起:提供者(回應者)接受", () => {
    expect(run("requested", "accept", user(G), order("requested", R))).toEqual({ ok: true, noop: false, to: "accepted", settle: null });
  });
  it("提供者發起:接受者(回應者)接受", () => {
    expect(run("requested", "accept", user(R), order("requested", G))).toMatchObject({ ok: true, to: "accepted" });
  });
  it("回應者婉拒", () => {
    expect(run("requested", "decline", user(G), order("requested", R))).toMatchObject({ ok: true, to: "declined" });
    expect(run("requested", "decline", user(R), order("requested", G))).toMatchObject({ ok: true, to: "declined" });
  });
  it("requested:發起者取消", () => {
    expect(run("requested", "cancel", user(R), order("requested", R))).toMatchObject({ ok: true, to: "cancelled" });
    expect(run("requested", "cancel", user(G), order("requested", G))).toMatchObject({ ok: true, to: "cancelled" });
  });
  it("accepted:任一方取消", () => {
    expect(run("accepted", "cancel", user(G))).toMatchObject({ ok: true, to: "cancelled" });
    expect(run("accepted", "cancel", user(R))).toMatchObject({ ok: true, to: "cancelled" });
  });
  it("提供者做完了", () => {
    expect(run("accepted", "mark_done", user(G))).toMatchObject({ ok: true, to: "done_by_giver" });
  });
  it("接受者確認 → 完成,以價格結算", () => {
    expect(run("done_by_giver", "confirm", user(R))).toEqual({ ok: true, noop: false, to: "completed", settle: "price" });
  });
  it("提供者這次免費:accepted 與 done_by_giver 都可,金額為 0", () => {
    expect(run("accepted", "waive", user(G))).toEqual({ ok: true, noop: false, to: "completed", settle: "free" });
    expect(run("done_by_giver", "waive", user(G))).toEqual({ ok: true, noop: false, to: "completed", settle: "free" });
  });
  it("系統自動確認:逾時後可以(含剛好等於)", () => {
    const due = new Date(NOW);
    expect(run("done_by_giver", "auto_confirm", SYSTEM, order("done_by_giver", R, due))).toMatchObject({ ok: true, to: "completed", settle: "price" });
    expect(run("done_by_giver", "auto_confirm", SYSTEM, order("done_by_giver", R, new Date(NOW.getTime() - 1)))).toMatchObject({ ok: true });
  });
});

describe("非權限方 → NOT_ALLOWED", () => {
  it("發起者自己不能接受或婉拒", () => {
    expect(run("requested", "accept", user(R), order("requested", R))).toEqual({ ok: false, code: "NOT_ALLOWED" });
    expect(run("requested", "decline", user(G), order("requested", G))).toEqual({ ok: false, code: "NOT_ALLOWED" });
  });
  it("requested 時回應者不能取消", () => {
    expect(run("requested", "cancel", user(G), order("requested", R))).toEqual({ ok: false, code: "NOT_ALLOWED" });
  });
  it("接受者不能按做完了或這次免費", () => {
    expect(run("accepted", "mark_done", user(R))).toEqual({ ok: false, code: "NOT_ALLOWED" });
    expect(run("accepted", "waive", user(R))).toEqual({ ok: false, code: "NOT_ALLOWED" });
  });
  it("提供者不能確認自己的服務", () => {
    expect(run("done_by_giver", "confirm", user(G))).toEqual({ ok: false, code: "NOT_ALLOWED" });
  });
  it("外人與使用者都不能自動確認;系統只能自動確認", () => {
    expect(run("done_by_giver", "auto_confirm", user(R), order("done_by_giver", R, NOW))).toEqual({ ok: false, code: "NOT_ALLOWED" });
    expect(run("accepted", "accept", SYSTEM)).toEqual({ ok: false, code: "NOT_ALLOWED" });
    expect(run("done_by_giver", "confirm", SYSTEM)).toEqual({ ok: false, code: "NOT_ALLOWED" });
  });
  it("非訂單成員做任何動作都是 NOT_ALLOWED(含非法來源狀態,權限優先)", () => {
    const actions: OrderAction[] = ["accept", "decline", "cancel", "mark_done", "confirm", "waive", "auto_confirm"];
    for (const status of ORDER_STATUSES) {
      for (const a of actions) {
        expect(run(status, a, user(X))).toEqual({ ok: false, code: "NOT_ALLOWED" });
      }
    }
  });
});

describe("非法來源狀態 → INVALID_STATE", () => {
  it("終態不能再轉換(其目標狀態以外)", () => {
    for (const s of ["declined", "cancelled", "completed"] as const) {
      expect(run(s, "mark_done", user(G))).toEqual({ ok: false, code: "INVALID_STATE" });
      expect(run(s, "waive", s === "completed" ? user(G) : user(G))).toMatchObject(s === "completed" ? { ok: true, noop: true } : { ok: false, code: "INVALID_STATE" });
    }
    expect(run("declined", "accept", user(G), order("declined", R))).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(run("cancelled", "accept", user(G), order("cancelled", R))).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(run("completed", "cancel", user(G))).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(run("done_by_giver", "cancel", user(G))).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("requested 不能直接做完了或確認", () => {
    expect(run("requested", "mark_done", user(G))).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(run("requested", "confirm", user(R))).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(run("requested", "waive", user(G))).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("accepted 不能直接確認", () => {
    expect(run("accepted", "confirm", user(R))).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("已婉拒的訂單不能接受;已取消的不能婉拒", () => {
    expect(run("declined", "decline", user(G), order("declined", R))).toMatchObject({ ok: true, noop: true });
    expect(run("cancelled", "decline", user(G), order("cancelled", R))).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("自動確認未到期 → INVALID_STATE", () => {
    const later = new Date(NOW.getTime() + 1);
    expect(run("done_by_giver", "auto_confirm", SYSTEM, order("done_by_giver", R, later))).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(run("done_by_giver", "auto_confirm", SYSTEM, order("done_by_giver", R, null))).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("accepted 不能自動確認", () => {
    expect(run("accepted", "auto_confirm", SYSTEM, order("accepted", R, NOW))).toEqual({ ok: false, code: "INVALID_STATE" });
  });
});

describe("冪等:已在目標狀態 → 無副作用的成功", () => {
  it("重複確認", () => expect(run("completed", "confirm", user(R))).toEqual({ ok: true, noop: true, to: "completed" }));
  it("重複接受", () => expect(run("accepted", "accept", user(G), order("accepted", R))).toEqual({ ok: true, noop: true, to: "accepted" }));
  it("重複取消", () => expect(run("cancelled", "cancel", user(G), order("cancelled", G))).toMatchObject({ ok: true, noop: true }));
  it("重複做完了", () => expect(run("done_by_giver", "mark_done", user(G))).toMatchObject({ ok: true, noop: true }));
  it("重複自動確認", () => expect(run("completed", "auto_confirm", SYSTEM)).toMatchObject({ ok: true, noop: true }));
  it("冪等也要有權限:非權限方重複呼叫仍是 NOT_ALLOWED", () => {
    expect(run("completed", "confirm", user(G))).toEqual({ ok: false, code: "NOT_ALLOWED" });
  });
});
