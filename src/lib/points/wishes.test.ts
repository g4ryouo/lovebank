import { describe, expect, it } from "vitest";
import { closestWishes } from "./wishes";

const item = (title: string, price: number) => ({ title, price });

describe("closestWishes", () => {
  const items = [item("a", 100), item("b", 600), item("c", 400), item("d", 200), item("free", 0)];

  it("只留價格高於餘額者,依還差愛心由少到多", () => {
    const r = closestWishes(items, 150);
    expect(r.map((w) => w.title)).toEqual(["d", "c", "b"]);
    expect(r.map((w) => w.gap)).toEqual([50, 250, 450]);
  });
  it("最多取 3 個(可調整)", () => {
    expect(closestWishes(items, 0)).toHaveLength(3);
    expect(closestWishes(items, 0, 2)).toHaveLength(2);
    expect(closestWishes(items, 0, 0)).toEqual([]);
  });
  it("價格等於餘額視為已達成,不算願望", () => {
    expect(closestWishes([item("x", 200)], 200)).toEqual([]);
  });
  it("價格 0(免費)不算願望", () => {
    expect(closestWishes([item("free", 0)], -50)).toEqual([]);
  });
  it("餘額為負:差距變大,進度為 0", () => {
    const [w] = closestWishes([item("x", 100)], -50);
    expect(w).toMatchObject({ gap: 150, progress: 0 });
  });
  it("進度是餘額 / 價格", () => {
    const [w] = closestWishes([item("x", 400)], 100);
    expect(w?.progress).toBe(0.25);
  });
  it("差距相同時價格較低者優先(穩定排序)", () => {
    const r = closestWishes([item("p", 500), item("q", 300)], 0);
    expect(r.map((w) => w.title)).toEqual(["q", "p"]);
  });
  it("全都夠買 → 空", () => expect(closestWishes(items, 99999)).toEqual([]));
  it("不改動傳入的陣列", () => {
    const copy = [...items];
    closestWishes(items, 0);
    expect(items).toEqual(copy);
  });
});
