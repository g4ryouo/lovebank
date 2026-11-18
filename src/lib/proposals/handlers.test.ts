import { describe, expect, it, vi } from "vitest";
import { MAX_PRICE } from "@/lib/config";
import { SUPPORT_UNAVAILABLE, counterProposalHandler, createProposalHandler, supportHandler, type HandlerDeps, type ProposalRow } from "./handlers";

const U = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PID = "33333333-3333-4333-8333-333333333333";

const row = (over: Partial<ProposalRow> = {}): ProposalRow => ({ id: PID, status: "pending", ai_verdict: "ok", ai_comment: "c", counter_price: null, counter_ai_verdict: null, counter_ai_comment: null, ...over });

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    reserve: vi.fn().mockResolvedValue({}),
    review: vi.fn().mockResolvedValue({ verdict: "ok", comment: "內容:好\n價格:好" }),
    reviewCounter: vi.fn().mockResolvedValue({ verdict: "caution", comment: "價格:偏低" }),
    ask: vi.fn().mockResolvedValue({ ok: true, reply: "答案" }),
    createProposal: vi.fn().mockResolvedValue({ data: row() }),
    getProposal: vi.fn().mockResolvedValue({ title: "按摩", emoji: "💆", price: 600, owner_id: U, status: "pending" }),
    setCounter: vi.fn().mockResolvedValue({ data: row({ status: "countered", counter_price: 300 }) }),
    ...over,
  };
}

describe("createProposalHandler", () => {
  it("成功:先預約次數、再審查、再寫入,並把審查結果一起存", async () => {
    const d = deps();
    const r = await createProposalHandler(U, { title: " 按摩 ", emoji: "💆", price: 600 }, d);
    expect(r.status).toBe(200);
    expect(d.reserve).toHaveBeenCalledWith(U, "proposal_review");
    expect(d.review).toHaveBeenCalledWith({ title: "按摩", emoji: "💆", price: 600 });
    expect(d.createProposal).toHaveBeenCalledWith({ actor: U, title: "按摩", emoji: "💆", price: 600, review: { verdict: "ok", comment: "內容:好\n價格:好" } });
  });
  it("輸入不合法:400,而且不花 AI 次數", async () => {
    for (const bad of [{}, { title: "", price: 1 }, { title: "x".repeat(41), price: 1 }, { title: "a", price: -1 }, { title: "a", price: MAX_PRICE + 1 }, { title: "a", price: 1.5 }, { title: "a", price: "100" }, null, "x"]) {
      const d = deps();
      const r = await createProposalHandler(U, bad, d);
      expect(r.status).toBe(400);
      expect(d.reserve).not.toHaveBeenCalled();
      expect(d.review).not.toHaveBeenCalled();
    }
  });
  it("每日上限用完:429,不呼叫 AI、不寫入", async () => {
    const d = deps({ reserve: vi.fn().mockResolvedValue({ code: "AI_LIMIT" }) });
    const r = await createProposalHandler(U, { title: "a", price: 1 }, d);
    expect(r.status).toBe(429);
    expect(r.body.code).toBe("AI_LIMIT");
    expect(d.review).not.toHaveBeenCalled();
    expect(d.createProposal).not.toHaveBeenCalled();
  });
  it("AI 無法審查:流程照常,以 unavailable 寫入", async () => {
    const d = deps({ review: vi.fn().mockResolvedValue({ verdict: "unavailable", comment: null }) });
    const r = await createProposalHandler(U, { title: "a", price: 1 }, d);
    expect(r.status).toBe(200);
    expect(vi.mocked(d.createProposal).mock.calls[0]?.[0].review.verdict).toBe("unavailable");
  });
  it("未配對:403;資料庫未知錯誤不洩漏內部訊息", async () => {
    const a = await createProposalHandler(U, { title: "a", price: 1 }, deps({ createProposal: vi.fn().mockResolvedValue({ code: "NOT_PAIRED" }) }));
    expect(a.status).toBe(403);
    const b = await createProposalHandler(U, { title: "a", price: 1 }, deps({ createProposal: vi.fn().mockResolvedValue({ code: 'relation "x" does not exist' }) }));
    expect(b.status).toBe(500);
    expect(JSON.stringify(b.body)).not.toContain("relation");
  });
  it("多餘欄位(例如想指定對象或使用者 id)不會被使用", async () => {
    const d = deps();
    await createProposalHandler(U, { title: "a", price: 1, owner_id: OTHER, actor: OTHER }, d);
    expect(vi.mocked(d.createProposal).mock.calls[0]?.[0].actor).toBe(U);
  });
});

describe("counterProposalHandler", () => {
  it("成功:確認後才預約次數,以還價審查並寫入", async () => {
    const d = deps();
    const r = await counterProposalHandler(U, PID, { price: 300 }, d);
    expect(r.status).toBe(200);
    expect(d.reserve).toHaveBeenCalledWith(U, "proposal_review");
    expect(d.reviewCounter).toHaveBeenCalledWith({ title: "按摩", emoji: "💆", price: 300 });
    expect(d.setCounter).toHaveBeenCalledWith({ id: PID, actor: U, price: 300, review: { verdict: "caution", comment: "價格:偏低" } });
  });
  it("不是擁有者:403,不花次數(提案人不能替對方還價)", async () => {
    const d = deps({ getProposal: vi.fn().mockResolvedValue({ title: "a", emoji: null, price: 600, owner_id: OTHER, status: "pending" }) });
    const r = await counterProposalHandler(U, PID, { price: 300 }, d);
    expect(r.status).toBe(403);
    expect(d.reserve).not.toHaveBeenCalled();
  });
  it("還價第二次:409,不花次數", async () => {
    const d = deps({ getProposal: vi.fn().mockResolvedValue({ title: "a", emoji: null, price: 600, owner_id: U, status: "countered" }) });
    const r = await counterProposalHandler(U, PID, { price: 200 }, d);
    expect(r.status).toBe(409);
    expect(d.reserve).not.toHaveBeenCalled();
    expect(d.setCounter).not.toHaveBeenCalled();
  });
  it("看不到的提案(別的情侶,RLS 擋掉):404;壞 id:404", async () => {
    expect((await counterProposalHandler(U, PID, { price: 1 }, deps({ getProposal: vi.fn().mockResolvedValue(null) }))).status).toBe(404);
    expect((await counterProposalHandler(U, "not-a-uuid", { price: 1 }, deps())).status).toBe(404);
  });
  it("價格不合法或和原價一樣:400,不花次數", async () => {
    for (const bad of [{}, { price: -1 }, { price: MAX_PRICE + 1 }, { price: 0.5 }, { price: 600 }]) {
      const d = deps();
      expect((await counterProposalHandler(U, PID, bad, d)).status).toBe(400);
      expect(d.reserve).not.toHaveBeenCalled();
    }
  });
  it("每日上限用完:429", async () => {
    const d = deps({ reserve: vi.fn().mockResolvedValue({ code: "AI_LIMIT" }) });
    expect((await counterProposalHandler(U, PID, { price: 300 }, d)).status).toBe(429);
  });
});

describe("supportHandler", () => {
  const good = { messages: [{ role: "user", content: "婉拒會扣愛心嗎?" }] };
  it("成功:預約 support 次數後提問,只轉送對話", async () => {
    const d = deps();
    const r = await supportHandler(U, good, d);
    expect(r).toEqual({ status: 200, body: { reply: "答案" } });
    expect(d.reserve).toHaveBeenCalledWith(U, "support");
    expect(d.ask).toHaveBeenCalledWith(good.messages);
  });
  it("轉送給 AI 的內容不含使用者 id", async () => {
    const d = deps();
    await supportHandler(U, { messages: [{ role: "user", content: "你好", userId: U }], userId: U }, d);
    expect(JSON.stringify(vi.mocked(d.ask).mock.calls)).not.toContain(U);
  });
  it("格式不對:400,不花次數", async () => {
    const d = deps();
    expect((await supportHandler(U, { messages: [] }, d)).status).toBe(400);
    expect((await supportHandler(U, { messages: [{ role: "assistant", content: "x" }] }, d)).status).toBe(400);
    expect(d.reserve).not.toHaveBeenCalled();
  });
  it("上限用完:429;AI 壞掉:200 與溫和提示", async () => {
    expect((await supportHandler(U, good, deps({ reserve: vi.fn().mockResolvedValue({ code: "AI_LIMIT" }) }))).status).toBe(429);
    const r = await supportHandler(U, good, deps({ ask: vi.fn().mockResolvedValue({ ok: false }) }));
    expect(r).toEqual({ status: 200, body: { reply: SUPPORT_UNAVAILABLE, unavailable: true } });
  });
});
