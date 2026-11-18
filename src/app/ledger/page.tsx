import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { touchCouple } from "@/lib/touch";
import { getWallet } from "@/lib/wallet";
import { signed, toLedgerLines } from "@/lib/points/ledger-view";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

const LIMIT = 100;

const when = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function LedgerPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase); // 先補發零用愛心、自動確認,帳本才是最新的
  const [wallet, partnerRes, ledgerRes] = await Promise.all([
    getWallet(supabase, me.credit_limit),
    supabase.from("profiles").select("nickname").neq("id", user.id).maybeSingle(),
    // RLS:只讀得到自己的帳。訂單名稱用建立當下的快照,改菜單後不變。
    supabase
      .from("ledger")
      .select("id, delta, reason, period_key, note, created_at, orders(title_snapshot, emoji_snapshot)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIMIT),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";
  const entries = ledgerRes.data ?? [];
  const lines = toLedgerLines(entries, wallet.balance, partner);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <Link href="/" className="text-sm text-muted underline">
        ← 回首頁
      </Link>
      <header className="rounded-card bg-primary-soft p-6 text-center shadow-sm">
        <h1 className="text-3xl text-primary-strong">我的愛心帳本 📒</h1>
        <p className="mt-3 text-sm text-muted">目前的愛心</p>
        <p className="text-5xl text-primary-strong">{wallet.balance}</p>
        {(wallet.reserved > 0 || wallet.creditLimit > 0) && (
          <p className="mt-3 text-sm text-muted">
            可以用的 {wallet.available}
            {wallet.reserved > 0 ? ` · 預留中 ${wallet.reserved}` : ""}
            {wallet.creditLimit > 0 ? ` · 額度 ${wallet.creditLimit}` : ""}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">這本帳只有你自己看得到喔</p>
      </header>

      {lines.length === 0 && <p className="text-center text-sm text-muted">還沒有任何紀錄</p>}
      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-foreground">{l.title}</p>
              {l.detail && <p className="truncate text-xs text-muted">{l.detail}</p>}
              <p className="text-xs text-muted">{when(l.createdAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-xl ${l.delta > 0 ? "text-primary-strong" : "text-muted"}`}>{signed(l.delta)}</p>
              <p className="text-xs text-muted">剩 {l.balanceAfter}</p>
            </div>
          </li>
        ))}
      </ul>
      {entries.length === LIMIT && <p className="text-center text-xs text-muted">只顯示最近 {LIMIT} 筆</p>}
    </main>
  );
}
