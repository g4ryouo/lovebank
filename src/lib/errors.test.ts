import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, GENERIC_ERROR, friendlyError, parseErrorCode } from "./errors";

describe("parseErrorCode", () => {
  it("認得代碼", () => expect(parseErrorCode("COUPLE_FULL")).toBe("COUPLE_FULL"));
  it("容許前後文字", () => expect(parseErrorCode("error: INVITE_INVALID ")).toBe("INVITE_INVALID"));
  it("不認得 → null", () => {
    expect(parseErrorCode("permission denied")).toBeNull();
    expect(parseErrorCode(null)).toBeNull();
    expect(parseErrorCode("")).toBeNull();
  });
});

describe("friendlyError", () => {
  it("已知代碼回溫暖訊息", () => expect(friendlyError("INSUFFICIENT_CREDIT")).toBe("愛心還不夠,再存一下吧"));
  it("未知錯誤不洩漏內部細節", () => expect(friendlyError('relation "x" does not exist')).toBe(GENERIC_ERROR));
  it("訊息不含冷冰冰的金融用語", () => {
    for (const msg of Object.values(ERROR_MESSAGES)) {
      expect(msg).not.toMatch(/餘額不足|扣款|付款|交易|拒絕/);
    }
  });
});
