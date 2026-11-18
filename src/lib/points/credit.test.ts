import { describe, expect, it } from "vitest";
import { availableCredit, canAfford, computeReserved } from "./credit";

describe("availableCredit", () => {
  it("balance + limit − reserved", () => expect(availableCredit(1000, 200, 300)).toBe(900));
  it("餘額為負時仍可計算", () => expect(availableCredit(-100, 500, 0)).toBe(400));
  it("可用額度可為負", () => expect(availableCredit(0, 0, 300)).toBe(-300));
  it("非整數丟錯", () => expect(() => availableCredit(1.2, 0, 0)).toThrow(RangeError));
});

describe("canAfford", () => {
  it("剛好等於可用額度可以", () => expect(canAfford(500, 0, 0, 500)).toBe(true));
  it("差 1 不行", () => expect(canAfford(499, 0, 0, 500)).toBe(false));
  it("預留會占用額度", () => expect(canAfford(1000, 0, 600, 500)).toBe(false));
  it("信用額度可補不足", () => expect(canAfford(100, 400, 0, 500)).toBe(true));
  it("餘額為負但額度足夠", () => expect(canAfford(-100, 1000, 0, 500)).toBe(true));
  it("價格 0 一律可以,即使 available 為負", () => expect(canAfford(-50, 0, 300, 0)).toBe(true));
  it("負價格或小數丟錯", () => {
    expect(() => canAfford(100, 0, 0, -1)).toThrow(RangeError);
    expect(() => canAfford(100, 0, 0, 0.5)).toThrow(RangeError);
  });
});

describe("computeReserved", () => {
  const o = (status: "requested" | "accepted" | "done_by_giver" | "completed" | "cancelled", price: number, receiverId = "r") => ({
    status,
    receiverId,
    priceSnapshot: price,
  });
  it("只計 accepted 與 done_by_giver", () => {
    const orders = [o("requested", 10), o("accepted", 20), o("done_by_giver", 30), o("completed", 40), o("cancelled", 50)];
    expect(computeReserved(orders, "r")).toBe(50);
  });
  it("只計該接受者", () => {
    expect(computeReserved([o("accepted", 20, "r"), o("accepted", 70, "other")], "r")).toBe(20);
  });
  it("沒有訂單為 0", () => expect(computeReserved([], "r")).toBe(0));
});
