import { describe, expect, it } from "vitest";
import { agreedPrice, proposalActions, waitingOn, type ProposalStatus } from "./actions-model";

describe("proposalActions", () => {
  it("擁有者:待回應時可同意、還價、婉拒", () => expect(proposalActions("pending", "owner")).toEqual(["agree", "counter", "reject"]));
  it("擁有者:還價之後不能再還價(只能一次)", () => {
    expect(proposalActions("countered", "owner")).toEqual([]);
    expect(proposalActions("countered", "owner")).not.toContain("counter");
  });
  it("提案人:待回應只能撤回", () => expect(proposalActions("pending", "proposer")).toEqual(["withdraw"]));
  it("提案人:被還價可接受、婉拒或撤回", () => expect(proposalActions("countered", "proposer")).toEqual(["accept_counter", "decline_counter", "withdraw"]));
  it("終態沒有任何按鈕", () => {
    for (const s of ["agreed", "rejected", "withdrawn"] as ProposalStatus[]) {
      expect(proposalActions(s, "owner")).toEqual([]);
      expect(proposalActions(s, "proposer")).toEqual([]);
    }
  });
});

describe("waitingOn", () => {
  it("誰該回應", () => {
    expect(waitingOn("pending", "owner")).toBe("me");
    expect(waitingOn("pending", "proposer")).toBe("them");
    expect(waitingOn("countered", "proposer")).toBe("me");
    expect(waitingOn("countered", "owner")).toBe("them");
    expect(waitingOn("agreed", "owner")).toBe("none");
  });
});

describe("agreedPrice", () => {
  it("同意用原價;接受還價用還價", () => {
    expect(agreedPrice({ price: 600, counter_price: 300 }, false)).toBe(600);
    expect(agreedPrice({ price: 600, counter_price: 300 }, true)).toBe(300);
    expect(agreedPrice({ price: 600, counter_price: null }, true)).toBe(600);
  });
});
