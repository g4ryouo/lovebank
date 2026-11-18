import { z } from "zod";
import { MAX_PRICE } from "@/lib/config";
import { friendlyError, parseErrorCode } from "@/lib/errors";
import type { ReviewResult, ProposalForReview } from "@/lib/ai/review";
import { OFF_TOPIC_REPLY, supportRequestSchema, type SupportMessage, type SupportResult } from "@/lib/ai/support";

/** 回給前端的結果。status 是 HTTP 狀態碼。 */
export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export type AiKind = "proposal_review" | "support";

export interface ProposalRow {
  id: string;
  status: string;
  ai_verdict: string | null;
  ai_comment: string | null;
  counter_price: number | null;
  counter_ai_verdict: string | null;
  counter_ai_comment: string | null;
}

export interface ProposalSummary {
  title: string;
  emoji: string | null;
  price: number;
  owner_id: string;
  status: string;
}

/** 所有外部依賴都從這裡注入,方便測試(實際接線見 server-deps.ts) */
export interface HandlerDeps {
  reserve(userId: string, kind: AiKind): Promise<{ code?: string }>;
  review(p: ProposalForReview): Promise<ReviewResult>;
  reviewCounter(p: ProposalForReview): Promise<ReviewResult>;
  ask(messages: SupportMessage[]): Promise<SupportResult>;
  createProposal(args: { actor: string; title: string; emoji: string | null; price: number; review: ReviewResult }): Promise<{ data?: ProposalRow; code?: string }>;
  getProposal(id: string): Promise<ProposalSummary | null>;
  setCounter(args: { id: string; actor: string; price: number; review: ReviewResult }): Promise<{ data?: ProposalRow; code?: string }>;
}

const STATUS_BY_CODE: Record<string, number> = {
  AI_LIMIT: 429,
  NOT_PAIRED: 403,
  NOT_ALLOWED: 403,
  INVALID_STATE: 409,
  INVALID_AMOUNT: 400,
};

function fail(code: string | undefined, fallbackStatus = 500): HandlerResult {
  const known = parseErrorCode(code ?? "");
  return { status: known ? (STATUS_BY_CODE[known] ?? 400) : fallbackStatus, body: { error: friendlyError(code ?? ""), code: known } };
}

export const proposalInputSchema = z.object({
  title: z.string().trim().min(1, "給這個提案取個名字吧").max(40, "名字最多 40 個字喔"),
  emoji: z
    .string()
    .trim()
    .max(8, "圖示放一個表情符號就好囉")
    .nullish()
    .transform((v) => (v ? v : null)),
  price: z.number({ error: "價格要是整數喔" }).int("價格要是整數喔").min(0, "價格不能是負的喔").max(MAX_PRICE, `價格最多 ${MAX_PRICE} 喔`),
});
export const counterInputSchema = z.object({
  price: z.number({ error: "價格要是整數喔" }).int("價格要是整數喔").min(0, "價格不能是負的喔").max(MAX_PRICE, `價格最多 ${MAX_PRICE} 喔`),
});

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "資料看起來不太對喔";

/** 提案:驗證 → 預約 AI 次數 → AI 審查(失敗不擋) → 寫入 */
export async function createProposalHandler(userId: string, raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  const parsed = proposalInputSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) } };

  const reserved = await deps.reserve(userId, "proposal_review");
  if (reserved.code) return fail(reserved.code);

  const review = await deps.review({ title: parsed.data.title, emoji: parsed.data.emoji, price: parsed.data.price });
  const created = await deps.createProposal({ actor: userId, ...parsed.data, review });
  if (created.code || !created.data) return fail(created.code);
  return { status: 200, body: { proposal: created.data } };
}

/** 還價(只能一次):確認是擁有者且為 pending(不浪費次數)→ 預約 → 價格審查 → 寫入 */
export async function counterProposalHandler(userId: string, id: string, raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  if (!z.string().uuid().safeParse(id).success) return { status: 404, body: { error: "找不到這個提案" } };
  const parsed = counterInputSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) } };

  const p = await deps.getProposal(id);
  if (!p) return { status: 404, body: { error: "找不到這個提案" } };
  if (p.owner_id !== userId) return fail("NOT_ALLOWED");
  if (p.status !== "pending") return fail("INVALID_STATE");
  if (parsed.data.price === p.price) return fail("INVALID_AMOUNT");

  const reserved = await deps.reserve(userId, "proposal_review");
  if (reserved.code) return fail(reserved.code);

  const review = await deps.reviewCounter({ title: p.title, emoji: p.emoji, price: parsed.data.price });
  const result = await deps.setCounter({ id, actor: userId, price: parsed.data.price, review });
  if (result.code || !result.data) return fail(result.code);
  return { status: 200, body: { proposal: result.data } };
}

export const SUPPORT_UNAVAILABLE = "小幫手暫時休息中,等一下再來問我吧 💙";

/** 愛愛小幫手:驗證 → 預約次數 → 提問。送出的只有對話內容,沒有任何身分資料。 */
export async function supportHandler(userId: string, raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  const parsed = supportRequestSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "問題的格式不太對,換個方式再問一次吧" } };

  const reserved = await deps.reserve(userId, "support");
  if (reserved.code) return fail(reserved.code);

  const result = await deps.ask(parsed.data.messages);
  if (!result.ok) return { status: 200, body: { reply: SUPPORT_UNAVAILABLE, unavailable: true } };
  return { status: 200, body: { reply: result.reply } };
}

export { OFF_TOPIC_REPLY };
