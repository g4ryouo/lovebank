import { describe, expect, it } from "vitest";
import { CELEBRATE_WINDOW_MS, confettiPieces, shouldCelebrate } from "./celebrate";

const NOW = Date.parse("2026-01-10T12:00:00Z");
const base = { status: "completed", completedAt: "2026-01-10T11:58:00Z", now: NOW, seen: false, reducedMotion: false };

describe("shouldCelebrate", () => {
  it("剛完成、沒慶祝過、沒開減少動態 → 慶祝", () => expect(shouldCelebrate(base)).toBe(true));
  it("不是完成狀態 → 不慶祝", () => {
    for (const s of ["requested", "accepted", "done_by_giver", "declined", "cancelled", "expired"]) expect(shouldCelebrate({ ...base, status: s })).toBe(false);
  });
  it("已經慶祝過 → 不再放", () => expect(shouldCelebrate({ ...base, seen: true })).toBe(false));
  it("開了「減少動態效果」→ 不放", () => expect(shouldCelebrate({ ...base, reducedMotion: true })).toBe(false));
  it("太久以前完成的(舊的邀請)→ 不放", () => {
    expect(shouldCelebrate({ ...base, completedAt: new Date(NOW - CELEBRATE_WINDOW_MS - 1).toISOString() })).toBe(false);
    expect(shouldCelebrate({ ...base, completedAt: new Date(NOW - CELEBRATE_WINDOW_MS).toISOString() })).toBe(true);
  });
  it("沒有完成時間或時間在未來 → 不放", () => {
    expect(shouldCelebrate({ ...base, completedAt: null })).toBe(false);
    expect(shouldCelebrate({ ...base, completedAt: new Date(NOW + 60_000).toISOString() })).toBe(false);
  });
});

describe("confettiPieces", () => {
  it("數量正確、每次結果一樣、參數都在合理範圍", () => {
    const a = confettiPieces(28);
    expect(a).toHaveLength(28);
    expect(confettiPieces(28)).toEqual(a);
    for (const p of a) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left).toBeLessThanOrEqual(100);
      expect(p.dur).toBeGreaterThan(1);
      expect(p.dur).toBeLessThan(3.5);
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("顏色有變化", () => expect(new Set(confettiPieces(28).map((p) => p.color)).size).toBeGreaterThan(3));
});
