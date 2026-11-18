import { describe, expect, it } from "vitest";
import { MAX_PRICE } from "@/lib/config";
import { activeSchema, emojiSchema, menuItemSchema, priceSchema, titleSchema } from "./schemas";
import { MENU_TEMPLATES, findTemplate, unappliedTemplates } from "./templates";

describe("priceSchema", () => {
  it("接受 0(免費)與上限", () => {
    expect(priceSchema.parse("0")).toBe(0);
    expect(priceSchema.parse(String(MAX_PRICE))).toBe(MAX_PRICE);
  });
  it("拒絕超過上限、負數、小數、空字串、文字", () => {
    for (const bad of [String(MAX_PRICE + 1), "-1", "1.5", "", "abc", "1e3", " "]) {
      expect(priceSchema.safeParse(bad).success).toBe(false);
    }
  });
  it("去除前後空白", () => expect(priceSchema.parse(" 250 ")).toBe(250));
});

describe("titleSchema", () => {
  it("去空白、限制 1 到 40 字", () => {
    expect(titleSchema.parse("  抱抱 ")).toBe("抱抱");
    expect(titleSchema.safeParse("   ").success).toBe(false);
    expect(titleSchema.safeParse("x".repeat(40)).success).toBe(true);
    expect(titleSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});

describe("emojiSchema", () => {
  it("空字串變成 null", () => expect(emojiSchema.parse("  ")).toBeNull());
  it("保留表情符號", () => expect(emojiSchema.parse("💋")).toBe("💋"));
  it("太長被擋", () => expect(emojiSchema.safeParse("這是一段很長的文字不是表情").success).toBe(false));
});

describe("menuItemSchema", () => {
  it("整體驗證與轉型", () => {
    expect(menuItemSchema.parse({ title: " 按摩 ", emoji: "", price: "600" })).toEqual({ title: "按摩", emoji: null, price: 600 });
  });
});

describe("activeSchema", () => {
  it("轉成布林", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(activeSchema.parse({ id, active: "false" }).active).toBe(false);
    expect(activeSchema.parse({ id, active: "true" }).active).toBe(true);
    expect(activeSchema.safeParse({ id: "x", active: "true" }).success).toBe(false);
  });
});

describe("範本", () => {
  it("四個預設範本與價格(SPEC 第 10 節)", () => {
    expect(MENU_TEMPLATES.map((t) => [t.title, t.emoji, t.price])).toEqual([
      ["親親", "💋", 100],
      ["抱抱", "🤗", 200],
      ["按摩", "💆", 600],
      ["開車接送", "🚗", 400],
    ]);
  });
  it("每個範本都符合菜單規則", () => {
    for (const t of MENU_TEMPLATES) {
      expect(menuItemSchema.safeParse({ title: t.title, emoji: t.emoji, price: String(t.price) }).success).toBe(true);
    }
  });
  it("key 不重複、可查詢", () => {
    expect(new Set(MENU_TEMPLATES.map((t) => t.key)).size).toBe(MENU_TEMPLATES.length);
    expect(findTemplate("hug")?.title).toBe("抱抱");
    expect(findTemplate("nope")).toBeUndefined();
  });
  it("已套用的不再顯示", () => {
    expect(unappliedTemplates([]).length).toBe(4);
    expect(unappliedTemplates(["抱抱", " 親親 "]).map((t) => t.key)).toEqual(["massage", "ride"]);
    expect(unappliedTemplates(MENU_TEMPLATES.map((t) => t.title))).toEqual([]);
  });
});
