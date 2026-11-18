import { reviewCounterPrice, reviewProposal } from "@/lib/ai/review";
import { askSupport } from "@/lib/ai/support";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { HandlerDeps, ProposalRow } from "./handlers";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type UserDb = Awaited<ReturnType<typeof createClient>>;

/** 自動產生的型別把可為 null 的參數標成 string;資料庫函式實際上接受 null */
const orNull = (v: string | null | undefined) => (v ?? null) as unknown as string;

const toRow = (d: ProposalRow & Record<string, unknown>): ProposalRow => ({
  id: d.id,
  status: d.status,
  ai_verdict: d.ai_verdict,
  ai_comment: d.ai_comment,
  counter_price: d.counter_price,
  counter_ai_verdict: d.counter_ai_verdict,
  counter_ai_comment: d.counter_ai_comment,
});

/**
 * 實際接線:internal_* 函式一律用 admin client 呼叫(只授權給 service_role),
 * 讀取提案則用使用者自己的 client(受 RLS 約束)。呼叫這裡之前,route 已用 session 確認操作者身分。
 */
export function serverDeps(admin: Admin, userDb: UserDb): HandlerDeps {
  return {
    async reserve(userId, kind) {
      const { error } = await admin.rpc("internal_reserve_ai_call", { p_actor: userId, p_kind: kind });
      return error ? { code: error.message } : {};
    },
    review: (p) => reviewProposal(p),
    reviewCounter: (p) => reviewCounterPrice(p),
    ask: (messages) => askSupport(messages),
    async createProposal({ actor, title, emoji, price, review }) {
      const { data, error } = await admin.rpc("internal_create_proposal", {
        p_actor: actor,
        p_title: title,
        p_emoji: orNull(emoji),
        p_price: price,
        p_verdict: review.verdict,
        p_comment: orNull(review.comment),
      });
      return error || !data ? { code: error?.message } : { data: toRow(data as never) };
    },
    async getProposal(id) {
      const { data } = await userDb.from("service_proposals").select("title, emoji, price, owner_id, status").eq("id", id).maybeSingle();
      return data ?? null;
    },
    async setCounter({ id, actor, price, review }) {
      const { data, error } = await admin.rpc("internal_set_counter_review", {
        p_id: id,
        p_actor: actor,
        p_counter_price: price,
        p_verdict: review.verdict,
        p_comment: orNull(review.comment),
      });
      return error || !data ? { code: error?.message } : { data: toRow(data as never) };
    },
  };
}
