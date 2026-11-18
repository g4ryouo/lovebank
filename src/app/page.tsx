import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getViewer } from "@/lib/auth/viewer";
import { signOutAction } from "@/lib/pairing/actions";
import { closestWishes } from "@/lib/points/wishes";
import { getWallet } from "@/lib/wallet";
import { touchCouple } from "@/lib/touch";
import { groupOf } from "@/lib/orders/labels";
import { localDateKey } from "@/lib/points/allowance";
import { AutoRefresh } from "@/components/AutoRefresh";
import { WishBar } from "@/components/WishBar";

// 登入狀態因人而異,整頁都是動態內容:暫不要求即時顯示(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

/** 當地「今天」的日期(獨立成函式,讓頁面元件保持純粹) */
const todayKey = (timeZone: string) => localDateKey(new Date(), timeZone);

export default async function Home() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase); // 補發零用愛心、自動確認、標記過期;要先做,下面查到的才是最新的
  const [wallet, theirItems, openOrders, todayAllowance, limitRequests, proposals] = await Promise.all([
    getWallet(supabase, me.credit_limit),
    // RLS:對方的項目只讀得到啟用中的
    supabase.from("menu_items").select("id, title, emoji, price").neq("owner_id", user.id),
    supabase
      .from("orders")
      .select("id, status, giver_id, receiver_id, initiated_by, price_snapshot, settled_amount")
      .in("status", ["requested", "accepted", "done_by_giver"]),
    // 只讀得到自己的帳本:今天(依情侶時區)的零用愛心有沒有入帳
    supabase.from("ledger").select("id").eq("reason", "allowance").eq("period_key", todayKey(couple.timezone)).maybeSingle(),
    // 對方有沒有提出額度申請在等我回應
    supabase.from("limit_requests").select("id").eq("status", "pending").neq("requester_id", user.id),
    // 服務提案:等我回應的(我是擁有者且待回應,或我是提案人且被還價)
    supabase.from("service_proposals").select("id, owner_id, proposer_id, status").in("status", ["pending", "countered"]),
  ]);
  const wishes = closestWishes(theirItems.data ?? [], wallet.balance, 3);
  const open = openOrders.data ?? [];
  const waitingMe = open.filter((o) => groupOf(o, user.id) === "waiting-me").length;
  const ongoing = open.length - waitingMe;
  const limitWaiting = (limitRequests.data ?? []).length;
  const proposalWaiting = (proposals.data ?? []).filter(
    (p) => (p.status === "pending" && p.owner_id === user.id) || (p.status === "countered" && p.proposer_id === user.id),
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <AutoRefresh seconds={15} />
      <div className="w-full rounded-card bg-primary-soft px-8 py-10 shadow-sm">
        <h1 className="text-3xl text-primary-strong">💙 {APP_NAME}</h1>
        <p className="mt-3 text-muted">嗨,{me.nickname}!你們已經配對成功囉</p>
        <p className="mt-6 text-sm text-muted">我的愛心</p>
        <p className="text-5xl text-primary-strong">{wallet.balance}</p>
        {todayAllowance.data && <p className="mt-3 text-sm text-muted">今天的零用愛心 +{couple.daily_allowance} 已經入帳囉 ✓</p>}
      </div>

      {wishes.length > 0 && (
        <section className="w-full rounded-card bg-surface p-5 text-left shadow-sm">
          <h2 className="mb-3 text-lg text-foreground">最接近實現的願望 ✨</h2>
          <div className="flex flex-col gap-4">
            {wishes.map((w) => (
              <div key={w.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground">
                    {w.emoji} {w.title}
                  </p>
                  <p className="shrink-0 text-sm text-muted">{w.price} 愛心</p>
                </div>
                <WishBar progress={w.progress} label={`${w.title} 的願望進度`} />
                <p className="text-xs text-muted">還差 {w.gap} 愛心</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/orders"
        className={`flex w-full flex-col items-center rounded-card px-6 py-4 text-lg shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${waitingMe > 0 ? "bg-primary-strong text-white" : "bg-surface text-primary-strong"}`}
      >
        <span>我們的小心願</span>
        {(waitingMe > 0 || ongoing > 0) && (
          <span className={`text-sm ${waitingMe > 0 ? "text-white/90" : "text-muted"}`}>
            {waitingMe > 0 ? `有 ${waitingMe} 個等你回應 💙` : ""}
            {waitingMe > 0 && ongoing > 0 ? "," : ""}
            {ongoing > 0 ? `${ongoing} 個進行中` : ""}
          </span>
        )}
      </Link>
      <Link
        href="/partner"
        className="w-full rounded-full bg-primary-strong px-6 py-4 text-lg text-white shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        看看對方的菜單
      </Link>
      <Link
        href="/menu"
        className="w-full rounded-full bg-surface px-6 py-4 text-lg text-primary-strong shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        我的愛的菜單
      </Link>
      <Link
        href="/proposals"
        className={`w-full rounded-full px-6 py-4 text-lg shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${proposalWaiting > 0 ? "bg-primary-soft text-primary-strong" : "bg-surface text-primary-strong"}`}
      >
        想幫他加小心願 ✨{proposalWaiting > 0 ? `(${proposalWaiting} 個等你回應)` : ""}
      </Link>
      {limitWaiting > 0 && (
        <Link href="/settings" className="w-full rounded-card bg-primary-soft px-6 py-4 text-primary-strong shadow-sm">
          他提出了額度申請,去看看吧 💙
        </Link>
      )}
      <Link
        href="/settings"
        className="w-full rounded-full bg-surface px-6 py-4 text-lg text-primary-strong shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        愛心額度與送愛心 🎁
      </Link>
      <Link href="/help" className="w-full rounded-full bg-surface px-6 py-4 text-lg text-primary-strong shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100">
        愛愛小幫手 💬
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-muted underline">
          登出
        </button>
      </form>
    </main>
  );
}
