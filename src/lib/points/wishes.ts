import { wishProgress } from "./progress";

export interface WishCandidate {
  price: number;
}

export type Wish<T extends WishCandidate> = T & { gap: number; progress: number };

/**
 * 最接近達成的願望:對方菜單中「價格高於我的餘額」的項目,
 * 依還差多少愛心(價格 − 餘額)由少到多排序,同樣差距時價格較低者優先,取前 limit 個。
 * 價格 0 與餘額已足夠的項目不算願望。僅供畫面計算。
 */
export function closestWishes<T extends WishCandidate>(items: readonly T[], balance: number, limit = 3): Wish<T>[] {
  return items
    .filter((i) => i.price > 0 && i.price > balance)
    .map((i) => ({ ...i, gap: i.price - balance, progress: wishProgress(balance, i.price) }))
    .sort((a, b) => a.gap - b.gap || a.price - b.price)
    .slice(0, Math.max(0, limit));
}
