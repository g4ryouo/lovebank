import { describe, expect, it } from "vitest";
import { inviteCodeSchema, joinCoupleSchema, nicknameSchema, safeNext } from "./schemas";

describe("nicknameSchema", () => {
  it("去除前後空白", () => expect(nicknameSchema.parse("  小明 ")).toBe("小明"));
  it("空白與空字串不可", () => {
    expect(nicknameSchema.safeParse("   ").success).toBe(false);
    expect(nicknameSchema.safeParse("").success).toBe(false);
  });
  it("最多 20 字", () => {
    expect(nicknameSchema.safeParse("x".repeat(20)).success).toBe(true);
    expect(nicknameSchema.safeParse("x".repeat(21)).success).toBe(false);
  });
});

describe("inviteCodeSchema", () => {
  it("轉大寫、去空白", () => expect(inviteCodeSchema.parse(" abcd2345 ")).toBe("ABCD2345"));
  it("長度不對不可", () => {
    expect(inviteCodeSchema.safeParse("ABC").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABCD23456").success).toBe(false);
  });
  it("含易混淆字元 0 O 1 I 不可", () => {
    for (const bad of ["ABCD234O", "ABCD2340", "ABCD2341", "ABCD234I"]) {
      expect(inviteCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("joinCoupleSchema", () => {
  it("同時驗證兩個欄位", () => {
    expect(joinCoupleSchema.safeParse({ code: "abcd2345", nickname: "A" }).success).toBe(true);
    expect(joinCoupleSchema.safeParse({ code: "abcd2345", nickname: "" }).success).toBe(false);
  });
});

describe("safeNext", () => {
  it("站內路徑通過", () => expect(safeNext("/orders/1")).toBe("/orders/1"));
  it("缺值用預設", () => expect(safeNext(null)).toBe("/"));
  it("外部網址與雙斜線被擋", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("evil")).toBe("/");
  });
});
