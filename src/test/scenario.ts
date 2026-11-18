import type { FakeDb } from "./fake-supabase";

/**
 * 一個「玩了幾天」的情境:我是 G4Ry,對方是小恩恩。
 * 有預留中的邀請、等我回應的邀請、已完成的邀請、額度、提案與帳本。
 */
export const ME = { id: "me", nickname: "G4Ry", avatar_url: null as string | null, credit_limit: 500 };
export const PARTNER = { id: "partner", nickname: "小恩恩", avatar_url: null as string | null, credit_limit: 0 };

const COUPLE = {
  id: "c1",
  invite_code: "ABCD2345",
  invite_expires_at: "2026-12-31T00:00:00Z",
  paired_at: "2026-11-01T00:00:00Z",
  timezone: "Asia/Taipei",
  daily_allowance: 500,
};

export const IDS = {
  waitingMe: "11111111-1111-4111-8111-111111111111", // 小恩恩邀請我(我是提供者),等我回應
  accepted: "22222222-2222-4222-8222-222222222222", // 我已接受,要做的是我
  doneByMe: "33333333-3333-4333-8333-333333333333", // 小恩恩做完,等我確認(我是被服務的人)
  completed: "44444444-4444-4444-8444-444444444444",
  mineRequested: "55555555-5555-4555-8555-555555555555", // 我發起,等小恩恩
  proposalForMe: "66666666-6666-4666-8666-666666666666",
};

const order = (over: Record<string, unknown>) => ({
  couple_id: "c1",
  menu_item_id: "m1",
  price_snapshot: 200,
  settled_amount: null,
  note: null,
  created_at: "2026-11-18T10:00:00Z",
  accepted_at: null,
  done_at: null,
  auto_confirm_at: null,
  completed_at: null,
  expires_at: "2026-11-21T10:00:00Z",
  title_snapshot: "抱抱",
  emoji_snapshot: "🤗",
  ...over,
});

export function scenario(): FakeDb {
  return {
    profiles: [ME, PARTNER],
    menu_items: [
      { id: "m1", owner_id: "me", title: "按摩", emoji: "💆", price: 600, active: true, created_at: "2026-11-02T00:00:00Z" },
      { id: "m2", owner_id: "me", title: "愛愛", emoji: "😈", price: 3000, active: true, created_at: "2026-11-03T00:00:00Z" },
      { id: "m3", owner_id: "me", title: "洗碗", emoji: "🍽️", price: 0, active: false, created_at: "2026-11-04T00:00:00Z" },
      { id: "p1", owner_id: "partner", title: "抱抱", emoji: "🤗", price: 200, active: true, created_at: "2026-11-02T00:00:00Z" },
      { id: "p2", owner_id: "partner", title: "開車接送", emoji: "🚗", price: 2200, active: true, created_at: "2026-11-03T00:00:00Z" },
      { id: "p3", owner_id: "partner", title: "出國旅行", emoji: "✈️", price: 9000, active: true, created_at: "2026-11-04T00:00:00Z" },
      { id: "p4", owner_id: "partner", title: "早餐", emoji: "🥐", price: 0, active: true, created_at: "2026-11-05T00:00:00Z" },
    ],
    balances: [{ user_id: "me", balance: 2500 }],
    reserved: [{ user_id: "me", reserved: 600 }],
    orders: [
      order({ id: IDS.waitingMe, status: "requested", giver_id: "me", receiver_id: "partner", initiated_by: "partner", title_snapshot: "按摩", emoji_snapshot: "💆", price_snapshot: 600 }),
      order({ id: IDS.accepted, status: "accepted", giver_id: "me", receiver_id: "partner", initiated_by: "partner", accepted_at: "2026-11-18T11:00:00Z" }),
      order({ id: IDS.doneByMe, status: "done_by_giver", giver_id: "partner", receiver_id: "me", initiated_by: "me", price_snapshot: 600, title_snapshot: "洗車", emoji_snapshot: "🚗", accepted_at: "2026-11-18T11:00:00Z", done_at: "2026-11-18T12:00:00Z", auto_confirm_at: "2026-11-19T12:00:00Z" }),
      order({ id: IDS.completed, status: "completed", giver_id: "partner", receiver_id: "me", initiated_by: "me", settled_amount: 200, completed_at: new Date().toISOString() }),
      order({ id: IDS.mineRequested, status: "requested", giver_id: "partner", receiver_id: "me", initiated_by: "me", price_snapshot: 200 }),
    ],
    ledger: [
      { id: "l5", delta: -200, reason: "order", period_key: null, note: null, created_at: "2026-11-18T13:00:00Z", orders: { title_snapshot: "抱抱", emoji_snapshot: "🤗" } },
      { id: "l4", delta: 500, reason: "allowance", period_key: "2026-11-18", note: null, created_at: "2026-11-18T01:00:00Z", orders: null },
      { id: "l3", delta: -500, reason: "gift", period_key: null, note: "謝謝你這週的照顧", created_at: "2026-11-10T01:00:00Z", orders: null },
      { id: "l2", delta: 500, reason: "allowance", period_key: "2026-11-02", note: null, created_at: "2026-11-02T01:00:00Z", orders: null },
      { id: "l1", delta: 2000, reason: "initial", period_key: null, note: null, created_at: "2026-11-01T00:00:00Z", orders: null },
    ],
    limit_requests: [
      { id: "lr1", requester_id: "partner", requested_limit: 300, reason: "想存一點", status: "pending", created_at: "2026-11-18T09:00:00Z" },
    ],
    service_proposals: [
      { id: IDS.proposalForMe, proposer_id: "partner", owner_id: "me", title: "幫我按肩膀", emoji: "💆", price: 300, status: "pending", counter_price: null, ai_verdict: "ok", ai_comment: "內容:很貼心\n價格:合理", counter_ai_verdict: null, counter_ai_comment: null, created_at: "2026-11-18T08:00:00Z" },
      { id: "sp2", proposer_id: "me", owner_id: "partner", title: "帶我去日本玩", emoji: "✈️", price: 5000, status: "pending", counter_price: null, ai_verdict: "caution", ai_comment: "內容:友善\n價格:偏高", counter_ai_verdict: null, counter_ai_comment: null, created_at: "2026-11-17T08:00:00Z" },
    ],
  };
}

export const VIEWER = {
  user: { id: "me" },
  me: { id: "me", nickname: ME.nickname, avatar_url: ME.avatar_url, couple_id: "c1", credit_limit: ME.credit_limit, couples: COUPLE },
  couple: COUPLE,
  suggestedNickname: "G4Ry",
};
