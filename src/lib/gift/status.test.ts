import { describe, expect, it } from "vitest";
import { giftCooldown } from "./status";

const NOW = new Date("2026-01-10T12:00:00Z");

describe("giftCooldown", () => {
  it("沒送過 → 不在冷卻", () => expect(giftCooldown(null, NOW)).toEqual({ cooling: false, nextAt: null }));
  it("6 天 23 小時前送過 → 還在冷卻", () => {
    const r = giftCooldown(new Date(NOW.getTime() - (7 * 24 - 1) * 3600_000), NOW);
    expect(r.cooling).toBe(true);
  });
  it("剛好 7 天前送過 → 冷卻結束(與資料庫 created_at > now() − 7 天 一致)", () => {
    expect(giftCooldown(new Date(NOW.getTime() - 7 * 24 * 3600_000), NOW).cooling).toBe(false);
  });
  it("下次可送時間 = 上次 + 7 天", () => {
    expect(giftCooldown("2026-01-08T00:00:00Z", NOW).nextAt?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
