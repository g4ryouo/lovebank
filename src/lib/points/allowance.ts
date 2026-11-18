/** 把時間轉成指定時區的「當地日期」YYYY-MM-DD */
export function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(key: string, days: number): string {
  const t = Date.parse(`${key}T00:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 待補發零用點數的日期(SPEC 5.3)。
 * - 起算日:paired_at 當地日期的隔天。
 * - 只補到今天(當地)為止,且最多最近 maxDays 天。
 * - granted:已發過的日期會被排除(資料庫的唯一索引是最後防線)。
 * 回傳由舊到新排序的 YYYY-MM-DD。
 */
export function periodKeys(
  pairedAt: Date,
  now: Date,
  timeZone: string,
  maxDays: number,
  granted: Iterable<string> = [],
): string[] {
  if (!Number.isInteger(maxDays) || maxDays <= 0) return [];
  const start = addDays(localDateKey(pairedAt, timeZone), 1);
  const today = localDateKey(now, timeZone);
  if (start > today) return [];

  // 最近 maxDays 天的視窗,但不早於起算日
  const windowStart = addDays(today, -(maxDays - 1));
  const first = start > windowStart ? start : windowStart;

  const done = new Set(granted);
  const keys: string[] = [];
  for (let k = first; k <= today; k = addDays(k, 1)) {
    if (!done.has(k)) keys.push(k);
  }
  return keys;
}
