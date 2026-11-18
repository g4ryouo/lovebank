// 點數與訂單的共用型別。權威規則在資料庫函式(T3b),這裡供 UI 預覽與型別共用。

export const ORDER_STATUSES = [
  "requested",
  "accepted",
  "done_by_giver",
  "completed",
  "declined",
  "cancelled",
  "expired",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["completed", "declined", "cancelled", "expired"];
/** 會占用接受者額度的狀態(SPEC 5.1 的 reserved) */
export const RESERVING_STATUSES: readonly OrderStatus[] = ["accepted", "done_by_giver"];

export type OrderAction =
  | "accept"
  | "decline"
  | "cancel"
  | "mark_done"
  | "confirm"
  | "waive"
  | "auto_confirm"
  | "expire";

export type LedgerReason = "initial" | "allowance" | "order" | "gift" | "adjustment";

/** SPEC 第 8 節的錯誤代碼 */
export type ErrorCode =
  | "NOT_PAIRED"
  | "INVITE_INVALID"
  | "COUPLE_FULL"
  | "INVALID_STATE"
  | "NOT_ALLOWED"
  | "ITEM_INACTIVE"
  | "INSUFFICIENT_CREDIT"
  | "INSUFFICIENT_BALANCE"
  | "INVALID_AMOUNT"
  | "ALREADY_PENDING"
  | "LIMIT_TOO_HIGH"
  | "GIFT_LIMIT"
  | "AI_LIMIT";

/** 操作者:使用者(以 id 識別)或系統(touch_couple 的自動確認) */
export type Actor = { type: "user"; id: string } | { type: "system" };

/** 該使用者在這張訂單中的角色 */
export type OrderRole = "giver" | "receiver";

export interface LedgerEntryLike {
  delta: number;
}

export interface OrderLike {
  id: string;
  status: OrderStatus;
  giverId: string;
  receiverId: string;
  initiatedBy: string;
  priceSnapshot: number;
  autoConfirmAt: Date | null;
  /** requested 訂單的過期時間 */
  expiresAt: Date | null;
}

export interface LedgerEntryDraft {
  userId: string;
  delta: number;
  reason: LedgerReason;
  groupId: string;
  orderId: string;
}
