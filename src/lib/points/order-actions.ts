import { canTransition } from "./order-state";
import type { Actor, OrderAction, OrderLike, OrderStatus } from "./types";

/** UI 上有的按鈕(自動確認與自動過期由系統處理,沒有按鈕) */
export type UiOrderAction = Extract<OrderAction, "accept" | "decline" | "cancel" | "mark_done" | "confirm" | "waive">;

const UI_ACTIONS: readonly UiOrderAction[] = ["accept", "decline", "mark_done", "confirm", "waive", "cancel"];

/** 資料庫列(snake_case)轉成純函式用的 OrderLike */
export interface OrderRow {
  id: string;
  status: OrderStatus;
  giver_id: string;
  receiver_id: string;
  initiated_by: string;
  price_snapshot: number;
  auto_confirm_at: string | null;
  expires_at: string | null;
}

export function toOrderLike(row: OrderRow): OrderLike {
  return {
    id: row.id,
    status: row.status,
    giverId: row.giver_id,
    receiverId: row.receiver_id,
    initiatedBy: row.initiated_by,
    priceSnapshot: row.price_snapshot,
    autoConfirmAt: row.auto_confirm_at ? new Date(row.auto_confirm_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

/**
 * 這位使用者現在能按哪些按鈕(只含真的會改變狀態的動作)。
 * 規則直接沿用 canTransition,與資料庫函式一致;最終仍以資料庫為準。
 */
export function availableOrderActions(order: OrderLike, userId: string, now: Date): UiOrderAction[] {
  const actor: Actor = { type: "user", id: userId };
  return UI_ACTIONS.filter((a) => {
    const r = canTransition(order.status, a, actor, order, now);
    return r.ok && !r.noop;
  });
}
