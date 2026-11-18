import { describe, expect, it } from "vitest";
import { wishProgress } from "./progress";

describe("wishProgress", () => {
  it("一半", () => expect(wishProgress(250, 500)).toBe(0.5));
  it("剛好達成為 1", () => expect(wishProgress(500, 500)).toBe(1));
  it("超過仍為 1", () => expect(wishProgress(9999, 500)).toBe(1));
  it("餘額 0 為 0", () => expect(wishProgress(0, 500)).toBe(0));
  it("餘額為負顯示 0", () => expect(wishProgress(-300, 500)).toBe(0));
  it("價格 0 視為已達成", () => {
    expect(wishProgress(0, 0)).toBe(1);
    expect(wishProgress(-10, 0)).toBe(1);
  });
});
