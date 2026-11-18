import { RESERVING_STATUSES, type OrderLike } from "./types";

/** available = balance + credit_limit − reserved(SPEC 5.1) */
export function availableCredit(balance: number, creditLimit: number, reserved: number): number {
  for (const v of [balance, creditLimit, reserved]) {
    if (!Number.isSafeInteger(v)) throw new RangeError(`點數必須是整數:${v}`);
  }
  return balance + creditLimit - reserved;
}

/**
 * 是否負擔得起 price。規則:available ≥ price。
 * 價格 0 不花任何愛心,一律可以(即使額度調低後 available 為負)。
 * 注意:T3b 的資料庫函式必須與此一致。
 */
export function canAfford(
  balance: number,
  creditLimit: number,
  reserved: number,
  price: number,
): boolean {
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new RangeError(`價格必須是非負整數:${price}`);
  }
  if (price === 0) return true;
  return availableCredit(balance, creditLimit, reserved) >= price;
}

/** 某位接受者目前的預留總額:已接受但尚未完成的訂單價格加總 */
export function computeReserved(
  orders: readonly Pick<OrderLike, "status" | "receiverId" | "priceSnapshot">[],
  userId: string,
): number {
  let total = 0;
  for (const o of orders) {
    if (o.receiverId === userId && RESERVING_STATUSES.includes(o.status)) {
      total += o.priceSnapshot;
    }
  }
  return total;
}
