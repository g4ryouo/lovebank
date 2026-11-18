import { describe, expect, it } from "vitest";
import * as config from "./config";

describe("config", () => {
  it("SPEC 第 3 節常數", () => {
    expect(config.INITIAL_GRANT).toBe(2000);
    expect(config.DAILY_ALLOWANCE).toBe(500);
    expect(config.REQUEST_EXPIRE_DAYS).toBe(3);
    expect(config.MAX_PRICE).toBe(100000);
    expect(config.MAX_GIFT_AMOUNT).toBe(2000);
    expect(config.GIFT_COOLDOWN_DAYS).toBe(7);
    expect(config.MAX_CREDIT_LIMIT).toBe(2000);
    expect(config.AI_REVIEWS_PER_DAY).toBe(20);
    expect(config.SUPPORT_MESSAGES_PER_DAY).toBe(30);
    expect(config.DEFAULT_CREDIT_LIMIT).toBe(0);
    expect(config.DEFAULT_TIMEZONE).toBe("Asia/Taipei");
  });
  it("點數常數皆為整數", () => {
    for (const v of [config.INITIAL_GRANT, config.DAILY_ALLOWANCE, config.MAX_PRICE]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
