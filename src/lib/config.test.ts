import { describe, expect, it } from "vitest";
import * as config from "./config";

describe("config", () => {
  it("SPEC 第 3 節常數", () => {
    expect(config.INITIAL_GRANT).toBe(2000);
    expect(config.DAILY_ALLOWANCE).toBe(500);
    expect(config.REQUEST_EXPIRE_DAYS).toBe(3);
    expect(config.MAX_PRICE).toBe(100000);
    expect(config.DEFAULT_TIMEZONE).toBe("Asia/Taipei");
  });
  it("點數常數皆為整數", () => {
    for (const v of [config.INITIAL_GRANT, config.DAILY_ALLOWANCE, config.MAX_PRICE]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
