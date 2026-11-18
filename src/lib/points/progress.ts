/** 願望進度 = clamp(balance / price, 0, 1);餘額為負顯示 0;價格 0 視為已達成(1)。僅供畫面計算。 */
export function wishProgress(balance: number, price: number): number {
  if (price <= 0) return 1;
  if (balance <= 0) return 0;
  return Math.min(balance / price, 1);
}
