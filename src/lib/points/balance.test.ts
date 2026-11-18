import { describe, expect, it } from "vitest";
import { computeBalance } from "./balance";

describe("computeBalance", () => {
  it("空帳本為 0", () => expect(computeBalance([])).toBe(0));
  it("加總正負分錄", () => expect(computeBalance([{ delta: 2000 }, { delta: -300 }, { delta: 500 }])).toBe(2200));
  it("可以為負", () => expect(computeBalance([{ delta: 100 }, { delta: -250 }])).toBe(-150));
  it("非整數會丟錯", () => expect(() => computeBalance([{ delta: 1.5 }])).toThrow(RangeError));
  it("NaN 會丟錯", () => expect(() => computeBalance([{ delta: Number.NaN }])).toThrow(RangeError));
});
