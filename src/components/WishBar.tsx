/** 願望進度條:progress 為 0 到 1。僅為畫面計算。 */
export function WishBar({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-3 w-full overflow-hidden rounded-full bg-primary-soft"
    >
      <div className="h-full rounded-full bg-primary-strong transition-all duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}
