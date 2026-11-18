/** 提案頁依「身分 + 狀態」該出現哪些按鈕(畫面預覽,最終仍以資料庫函式為準) */
export type ProposalStatus = "pending" | "countered" | "agreed" | "rejected" | "withdrawn";
export type ProposalRole = "proposer" | "owner";
export type ProposalUiAction = "agree" | "reject" | "counter" | "accept_counter" | "decline_counter" | "withdraw";

export function proposalActions(status: ProposalStatus, role: ProposalRole): ProposalUiAction[] {
  if (role === "owner") {
    // 菜單擁有者:對提案同意、婉拒,或還價(只能一次,所以只在 pending 時出現)
    return status === "pending" ? ["agree", "counter", "reject"] : [];
  }
  // 提案人:對還價接受或婉拒;待回應或已還價時可撤回
  if (status === "countered") return ["accept_counter", "decline_counter", "withdraw"];
  if (status === "pending") return ["withdraw"];
  return [];
}

/** 這筆提案現在在等誰 */
export function waitingOn(status: ProposalStatus, role: ProposalRole): "me" | "them" | "none" {
  if (status === "pending") return role === "owner" ? "me" : "them";
  if (status === "countered") return role === "proposer" ? "me" : "them";
  return "none";
}

/** 成立後菜單項目的價格:原價,或對方還價後的價格 */
export function agreedPrice(p: { price: number; counter_price: number | null }, viaCounter: boolean): number {
  return viaCounter && p.counter_price !== null ? p.counter_price : p.price;
}
