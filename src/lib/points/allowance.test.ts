import { describe, expect, it } from "vitest";
import { localDateKey, periodKeys } from "./allowance";

const TPE = "Asia/Taipei";
// 台北 2026-01-01 10:00 配對
const PAIRED = new Date("2026-01-01T02:00:00Z");

describe("localDateKey", () => {
  it("依時區取當地日期(跨日邊界)", () => {
    expect(localDateKey(new Date("2026-01-01T15:59:59Z"), TPE)).toBe("2026-01-01");
    expect(localDateKey(new Date("2026-01-01T16:00:00Z"), TPE)).toBe("2026-01-02");
    expect(localDateKey(new Date("2026-01-01T16:00:00Z"), "UTC")).toBe("2026-01-01");
  });
});

describe("periodKeys", () => {
  it("配對當天不發", () => {
    expect(periodKeys(PAIRED, new Date("2026-01-01T15:00:00Z"), TPE, 7)).toEqual([]);
  });
  it("隔天(當地)首次開啟補發 1 天", () => {
    expect(periodKeys(PAIRED, new Date("2026-01-01T16:00:00Z"), TPE, 7)).toEqual(["2026-01-02"]);
  });
  it("台北 23:59 仍是同一天,00:00 才算新的一天", () => {
    expect(periodKeys(PAIRED, new Date("2026-01-02T15:59:59Z"), TPE, 7)).toEqual(["2026-01-02"]);
    expect(periodKeys(PAIRED, new Date("2026-01-02T16:00:00Z"), TPE, 7)).toEqual(["2026-01-02", "2026-01-03"]);
  });
  it("配對在當地深夜:起算日仍是當地隔天", () => {
    // UTC 2026-01-01T16:30 = 台北 01-02 00:30 → 起算 01-03
    const lateNight = new Date("2026-01-01T16:30:00Z");
    expect(periodKeys(lateNight, new Date("2026-01-02T15:00:00Z"), TPE, 7)).toEqual([]);
    expect(periodKeys(lateNight, new Date("2026-01-02T16:00:00Z"), TPE, 7)).toEqual(["2026-01-03"]);
  });
  it("超過上限只補最近 7 天(含今天)", () => {
    const keys = periodKeys(PAIRED, new Date("2026-01-20T04:00:00Z"), TPE, 7);
    expect(keys).toEqual(["2026-01-14", "2026-01-15", "2026-01-16", "2026-01-17", "2026-01-18", "2026-01-19", "2026-01-20"]);
  });
  it("剛好 7 天未開補 7 天,第 8 天只補最近 7 天", () => {
    expect(periodKeys(PAIRED, new Date("2026-01-08T04:00:00Z"), TPE, 7)).toHaveLength(7);
    const eight = periodKeys(PAIRED, new Date("2026-01-09T04:00:00Z"), TPE, 7);
    expect(eight).toHaveLength(7);
    expect(eight[0]).toBe("2026-01-03");
  });
  it("已發過的日期被排除(重複開啟不重複發)", () => {
    const now = new Date("2026-01-04T04:00:00Z");
    expect(periodKeys(PAIRED, now, TPE, 7, ["2026-01-02", "2026-01-03", "2026-01-04"])).toEqual([]);
    expect(periodKeys(PAIRED, now, TPE, 7, new Set(["2026-01-03"]))).toEqual(["2026-01-02", "2026-01-04"]);
  });
  it("上限內中間有漏發也會補上", () => {
    expect(periodKeys(PAIRED, new Date("2026-01-05T04:00:00Z"), TPE, 7, ["2026-01-02", "2026-01-05"])).toEqual(["2026-01-03", "2026-01-04"]);
  });
  it("maxDays 為 0 或負數 → 空", () => {
    expect(periodKeys(PAIRED, new Date("2026-01-20T04:00:00Z"), TPE, 0)).toEqual([]);
    expect(periodKeys(PAIRED, new Date("2026-01-20T04:00:00Z"), TPE, -3)).toEqual([]);
  });
  it("跨月與跨年", () => {
    const p = new Date("2025-12-30T02:00:00Z");
    expect(periodKeys(p, new Date("2026-01-02T04:00:00Z"), TPE, 7)).toEqual(["2025-12-31", "2026-01-01", "2026-01-02"]);
  });
  it("閏日", () => {
    const p = new Date("2028-02-27T02:00:00Z");
    expect(periodKeys(p, new Date("2028-03-01T04:00:00Z"), TPE, 7)).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });
  it("有日光節約時間的時區也以當地日期計算", () => {
    // 美東 2026-03-08 切換夏令時間;配對 03-07,03-10 開啟 → 03-08、03-09、03-10
    const p = new Date("2026-03-07T15:00:00Z");
    expect(periodKeys(p, new Date("2026-03-10T15:00:00Z"), "America/New_York", 7)).toEqual(["2026-03-08", "2026-03-09", "2026-03-10"]);
  });
  it("現在早於配對 → 空", () => {
    expect(periodKeys(PAIRED, new Date("2025-12-01T00:00:00Z"), TPE, 7)).toEqual([]);
  });
});
