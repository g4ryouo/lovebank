import type { Actor, ErrorCode, OrderAction, OrderLike, OrderRole, OrderStatus } from "./types";

export type TransitionResult =
  /** 可執行:狀態變為 to;settledAmount 只在完成時有值("price" = 價格快照、0 = 免費) */
  | { ok: true; noop: false; to: OrderStatus; settle: "price" | "free" | null }
  /** 已在目標狀態:無副作用的成功(冪等) */
  | { ok: true; noop: true; to: OrderStatus }
  | { ok: false; code: Extract<ErrorCode, "NOT_ALLOWED" | "INVALID_STATE"> };

interface Rule {
  from: readonly OrderStatus[];
  to: OrderStatus;
  settle: "price" | "free" | null;
}

/** 狀態轉換表(SPEC 第 6 節) */
const RULES: Record<OrderAction, Rule> = {
  accept: { from: ["requested"], to: "accepted", settle: null },
  decline: { from: ["requested"], to: "declined", settle: null },
  cancel: { from: ["requested", "accepted"], to: "cancelled", settle: null },
  mark_done: { from: ["accepted"], to: "done_by_giver", settle: null },
  confirm: { from: ["done_by_giver"], to: "completed", settle: "price" },
  waive: { from: ["accepted", "done_by_giver"], to: "completed", settle: "free" },
  auto_confirm: { from: ["done_by_giver"], to: "completed", settle: "price" },
  expire: { from: ["requested"], to: "expired", settle: null },
};

export function roleOf(userId: string, order: Pick<OrderLike, "giverId" | "receiverId">): OrderRole | null {
  if (userId === order.giverId) return "giver";
  if (userId === order.receiverId) return "receiver";
  return null;
}

/** 回應者 = 訂單中不是發起者的那一方 */
function isResponder(userId: string, order: OrderLike): boolean {
  return roleOf(userId, order) !== null && userId !== order.initiatedBy;
}

/** 這位操作者在「目前狀態」下是否有權限做這個動作 */
function isAllowed(action: OrderAction, actor: Actor, order: OrderLike): boolean {
  const systemOnly = action === "auto_confirm" || action === "expire";
  if (actor.type === "system") return systemOnly;
  if (systemOnly) return false;
  const role = roleOf(actor.id, order);
  if (role === null) return false;
  switch (action) {
    case "accept":
    case "decline":
      return isResponder(actor.id, order);
    case "cancel":
      // requested:只有發起者;accepted(及其他狀態,交由狀態檢查):任一方
      return order.status === "requested" ? actor.id === order.initiatedBy : true;
    case "mark_done":
    case "waive":
      return role === "giver";
    case "confirm":
      return role === "receiver";
    default:
      return false;
  }
}

/**
 * 判斷某個動作能否進行。檢查順序與資料庫一致:先權限(NOT_ALLOWED),再狀態(INVALID_STATE)。
 * 已在目標狀態 → 無副作用的成功。自動確認需 now ≥ auto_confirm_at;自動過期需 now ≥ expires_at。
 * requested 訂單逾期後,接受 / 婉拒 / 取消一律 INVALID_STATE(等 touch_couple 標為 expired)。
 */
export function canTransition(
  state: OrderStatus,
  action: OrderAction,
  actor: Actor,
  order: OrderLike,
  now: Date,
): TransitionResult {
  const rule = RULES[action];
  const current: OrderLike = { ...order, status: state };

  if (!isAllowed(action, actor, current)) return { ok: false, code: "NOT_ALLOWED" };

  if (state === rule.to) return { ok: true, noop: true, to: rule.to };
  if (!rule.from.includes(state)) return { ok: false, code: "INVALID_STATE" };

  if (state === "requested") {
    const overdue = order.expiresAt !== null && order.expiresAt.getTime() <= now.getTime();
    if (action === "expire") {
      if (!overdue) return { ok: false, code: "INVALID_STATE" };
    } else if (overdue) {
      return { ok: false, code: "INVALID_STATE" };
    }
  }
  if (action === "auto_confirm") {
    if (order.autoConfirmAt === null || order.autoConfirmAt.getTime() > now.getTime()) {
      return { ok: false, code: "INVALID_STATE" };
    }
  }
  return { ok: true, noop: false, to: rule.to, settle: rule.settle };
}
