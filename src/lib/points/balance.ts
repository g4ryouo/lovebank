import type { LedgerEntryLike } from "./types";

/** 餘額 = ledger.delta 加總。點數一律是整數。 */
export function computeBalance(entries: readonly LedgerEntryLike[]): number {
  let total = 0;
  for (const e of entries) {
    if (!Number.isSafeInteger(e.delta)) {
      throw new RangeError(`ledger delta 必須是整數:${e.delta}`);
    }
    total += e.delta;
  }
  return total;
}
