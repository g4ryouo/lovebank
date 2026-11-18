import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { proposalActions, waitingOn, type ProposalStatus } from "@/lib/proposals/actions-model";
import { CounterForm, NewProposalForm, ProposalButtons } from "@/components/ProposalForms";
import { AutoRefresh } from "@/components/AutoRefresh";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

const VERDICT: Record<string, { text: string; style: string }> = {
  ok: { text: "AI 小提醒:看起來不錯 ✓", style: "bg-primary-soft text-primary-strong" },
  caution: { text: "AI 有一點小提醒", style: "bg-amber-50 text-amber-700" },
  unavailable: { text: "AI 暫時無法審查(不影響流程)", style: "bg-surface text-muted" },
};

const STATUS_TEXT: Record<ProposalStatus, string> = {
  pending: "等待回應",
  countered: "已還價,等提案的人回應",
  agreed: "成立了 💙 已經加進菜單",
  rejected: "婉拒了",
  withdrawn: "已撤回",
};

function Opinion({ verdict, comment }: { verdict: string | null; comment: string | null }) {
  const v = VERDICT[verdict ?? "unavailable"] ?? VERDICT.unavailable!;
  return (
    <div className={`rounded-2xl p-3 text-sm ${v.style}`}>
      <p>{v.text}</p>
      {comment && <p className="mt-1 whitespace-pre-line text-muted">{comment}</p>}
    </div>
  );
}

export default async function ProposalsPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  const [partnerRes, listRes] = await Promise.all([
    supabase.from("profiles").select("nickname").neq("id", user.id).maybeSingle(),
    supabase
      .from("service_proposals")
      .select("id, proposer_id, owner_id, title, emoji, price, status, counter_price, ai_verdict, ai_comment, counter_ai_verdict, counter_ai_comment, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";
  const all = listRes.data ?? [];
  const mine = (p: (typeof all)[number]) => (p.owner_id === user.id ? ("owner" as const) : ("proposer" as const));
  const waitingMe = all.filter((p) => waitingOn(p.status, mine(p)) === "me");
  const waitingThem = all.filter((p) => waitingOn(p.status, mine(p)) === "them");
  const finished = all.filter((p) => waitingOn(p.status, mine(p)) === "none").slice(0, 10);

  const card = (p: (typeof all)[number]) => {
    const role = mine(p);
    const actions = proposalActions(p.status, role);
    const simple = actions.filter((a): a is Exclude<typeof a, "counter"> => a !== "counter");
    return (
      <article key={p.id} className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl text-foreground">
            {p.emoji} {p.title}
          </p>
          <p className="shrink-0 text-lg text-primary-strong">{p.price === 0 ? "免費" : `${p.price} 愛心`}</p>
        </div>
        <p className="text-sm text-muted">
          {role === "owner" ? `${partner}想要你提供這個服務` : `你想要${partner}提供這個服務`} · {STATUS_TEXT[p.status]}
        </p>
        <Opinion verdict={p.ai_verdict} comment={p.ai_comment} />
        {p.counter_price !== null && (
          <>
            <p className="text-foreground">
              還價 <span className="text-primary-strong">{p.counter_price} 愛心</span>
            </p>
            <Opinion verdict={p.counter_ai_verdict} comment={p.counter_ai_comment} />
          </>
        )}
        {actions.includes("counter") && <CounterForm id={p.id} currentPrice={p.price} />}
        <ProposalButtons id={p.id} actions={simple} />
      </article>
    );
  };

  const section = (title: string, list: typeof all, empty: string) => (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg text-foreground">{title}</h2>
      {list.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {list.map(card)}
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <AutoRefresh seconds={15} />
      <Link href="/" className="text-sm text-muted underline">
        ← 回首頁
      </Link>
      <header className="text-center">
        <h1 className="text-3xl text-primary-strong">想要{partner}提供的服務 ✨</h1>
        <p className="mt-2 text-sm text-muted">不能直接改{partner}的菜單,要經過他同意,這個服務才會加進去喔</p>
      </header>

      <section className="rounded-card bg-surface p-6 shadow-sm">
        <NewProposalForm partner={partner} />
      </section>

      {section("等我回應", waitingMe, "目前沒有要回應的 ✨")}
      {section("等他回應", waitingThem, "沒有在等待中的提案")}
      {finished.length > 0 && section("已結束", finished, "")}
    </main>
  );
}
