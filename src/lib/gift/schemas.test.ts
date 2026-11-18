import { describe, expect, it } from "vitest";
import { MAX_GIFT_AMOUNT } from "@/lib/config";
import { giftSchema } from "./schemas";

const parse = (amount: string, note = "") => giftSchema.safeParse({ amount, note });

describe("giftSchema", () => {
  it("1 到上限都可以", () => {
    expect(parse("1").success).toBe(true);
    expect(parse(String(MAX_GIFT_AMOUNT)).success).toBe(true);
  });
  it("0、負數、小數、超過上限、空白、文字都不行", () => {
    for (const bad of ["0", "-5", "1.5", String(MAX_GIFT_AMOUNT + 1), "", " ", "abc", "1e3"]) {
      expect(parse(bad).success).toBe(false);
    }
  });
  it("備註選填,空字串變 null,最多 40 字", () => {
    expect(giftSchema.parse({ amount: "100", note: "  " }).note).toBeNull();
    expect(giftSchema.parse({ amount: "100", note: " 謝謝你 " }).note).toBe("謝謝你");
    expect(parse("100", "x".repeat(41)).success).toBe(false);
  });
  it("轉成數字", () => expect(giftSchema.parse({ amount: " 250 ", note: "" }).amount).toBe(250));
});
