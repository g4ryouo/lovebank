import type { LedgerEntryDraft, OrderLike } from "./types";

/**
 * 完成訂單時要寫的 ledger 分錄:接受者 −amount、提供者 +amount,兩筆加總為 0。
 * amount 預設為價格快照;「這次免費」傳 0。金額為 0 時不寫任何分錄。
 */
export function buildSettlementEntries(
  order: Pick<OrderLike, "id" | "giverId" | "receiverId" | "priceSnapshot">,
  settledAmount: number = order.priceSnapshot,
): LedgerEntryDraft[] {
  if (!Number.isSafeInteger(settledAmount) || settledAmount < 0 || settledAmount > order.priceSnapshot) {
    throw new RangeError(`成交金額必須是 0 到 ${order.priceSnapshot} 的整數:${settledAmount}`);
  }
  if (settledAmount === 0) return [];
  const base = { reason: "order" as const, groupId: order.id, orderId: order.id };
  return [
    { ...base, userId: order.receiverId, delta: -settledAmount },
    { ...base, userId: order.giverId, delta: settledAmount },
  ];
}
