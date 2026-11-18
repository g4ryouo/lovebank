import { describe, expect, it } from "vitest";
import { MAX_CREDIT_LIMIT } from "@/lib/config";
import { decideSchema, limitSchema, requestLimitSchema } from "./schemas";

describe("limitSchema", () => {
  it("0 到上限都可以", () => {
    expect(limitSchema.parse("0")).toBe(0);
    expect(limitSchema.parse(String(MAX_CREDIT_LIMIT))).toBe(MAX_CREDIT_LIMIT);
  });
  it("超過上限、負數、小數、空白、文字都不行", () => {
    for (const bad of [String(MAX_CREDIT_LIMIT + 1), "-1", "1.5", "", " ", "abc", "1e3"]) {
      expect(limitSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("requestLimitSchema", () => {
  it("理由選填,空字串變 null", () => {
    expect(requestLimitSchema.parse({ limit: "500", reason: "  " })).toEqual({ limit: 500, reason: null });
    expect(requestLimitSchema.parse({ limit: "500", reason: " 想存一點 " }).reason).toBe("想存一點");
  });
  it("理由最多 100 字", () => {
    expect(requestLimitSchema.safeParse({ limit: "1", reason: "x".repeat(101) }).success).toBe(false);
  });
});

describe("decideSchema", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("轉成布林,id 必須是 uuid", () => {
    expect(decideSchema.parse({ id, approve: "true" }).approve).toBe(true);
    expect(decideSchema.parse({ id, approve: "false" }).approve).toBe(false);
    expect(decideSchema.safeParse({ id: "x", approve: "true" }).success).toBe(false);
    expect(decideSchema.safeParse({ id, approve: "maybe" }).success).toBe(false);
  });
});
