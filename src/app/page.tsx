import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getViewer } from "@/lib/auth/viewer";
import { closestWishes } from "@/lib/points/wishes";
import { getWallet } from "@/lib/wallet";
import { touchCouple } from "@/lib/touch";
import { groupOf } from "@/lib/orders/labels";
import { localDateKey } from "@/lib/points/allowance";
import { AutoRefresh } from "@/components/AutoRefresh";
import { WishBar } from "@/components/WishBar";
import { CouplePair } from "@/components/Avatar";

// 登入狀態因人而異,整頁都是動態內容:暫不要求即時顯示(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

/** 當地「今天」的日期(獨立成函式,讓頁面元件保持純粹) */
const todayKey = (timeZone: string) => localDateKey(new Date(), timeZone);

export default async function Home() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase); // 補發零用愛心、自動確認、標記過期;要先做,下面查到的才是最新的
  const [wallet, theirItems, myItems, openOrders, todayAllowance, limitRequests, proposals, partnerRes, myAvatar] = await Promise.all([
    getWallet(supabase, me.credit_limit),
    // RLS:對方的項目只讀得到啟用中的
    supabase.from("menu_items").select("id, title, emoji, price").neq("owner_id", user.id),
    supabase.from("menu_items").select("id").eq("owner_id", user.id).eq("active", true),
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
    // 對方的暱稱與 LINE 大頭貼(同一對的人才讀得到)
    supabase.from("profiles").select("nickname, avatar_url").neq("id", user.id).maybeSingle(),
    // 我的大頭貼:資料庫還沒有時,從我的登入憑證同步(只接受 LINE 官方圖片網址)
    me.avatar_url ? Promise.resolve(me.avatar_url) : supabase.rpc("sync_my_avatar").then((r) => r.data ?? null),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";
  // 離你最近的服務:以「可用愛心」(餘額 + 貸款額度 − 預留)判斷現在能不能邀請
  const wishes = closestWishes(theirItems.data ?? [], wallet.available, 3);
  const open = openOrders.data ?? [];
  const waitingMe = open.filter((o) => groupOf(o, user.id) === "waiting-me").length;
  const ongoing = open.length - waitingMe;
  const limitWaiting = (limitRequests.data ?? []).length;
  const proposalWaiting = (proposals.data ?? []).filter(
    (p) => (p.status === "pending" && p.owner_id === user.id) || (p.status === "countered" && p.proposer_id === user.id),
  ).length;

  // 等你處理:只在有事情時才出現,每一列直接帶你去處理
  const todo = [
    waitingMe > 0 && { href: "/orders", text: `${waitingMe} 個邀請等你處理` },
    proposalWaiting > 0 && { href: "/proposals", text: `${proposalWaiting} 個服務提案等你回應` },
    limitWaiting > 0 && { href: "/settings", text: `${partner}想調整愛心貸款額度` },
  ].filter((x): x is { href: string; text: string } => Boolean(x));
  const hasNoServices = (myItems.data ?? []).length === 0;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-5 p-6 text-center">
      <AutoRefresh seconds={15} />
      <div className="w-full rounded-card bg-primary-soft px-8 py-8 shadow-sm">
        <h1 className="text-2xl text-primary-strong">💙 {APP_NAME}</h1>
        <div className="mt-5">
          <CouplePair
            me={{ name: me.nickname, url: myAvatar }}
            partner={{ name: partner, url: partnerRes.data?.avatar_url ?? null }}
          />
        </div>
        <p className="mt-4 text-sm text-muted">我的愛心</p>
        <p className="text-5xl text-primary-strong">{wallet.balance}</p>
        {(wallet.reserved > 0 || wallet.creditLimit > 0) && (
          <p className="mt-2 text-sm text-muted">
            可以用的 {wallet.available}
            {wallet.reserved > 0 ? ` · 預留中 ${wallet.reserved}` : ""}
            {wallet.creditLimit > 0 ? ` · 可預支額度 ${wallet.creditLimit}` : ""}
          </p>
        )}
        {todayAllowance.data && <p className="mt-2 text-sm text-muted">今天的零用愛心 +{couple.daily_allowance} 已經入帳囉 ✓</p>}
        <Link href="/ledger" className="mt-3 inline-block text-sm text-primary-strong underline">
          看看愛心帳本
        </Link>
      </div>

      {todo.length > 0 && (
        <section className="w-full rounded-card bg-primary-strong p-5 text-left text-white shadow-md">
          <h2 className="mb-2 text-lg">等你處理 💙</h2>
          <ul className="flex flex-col">
            {todo.map((t) => (
              <li key={t.href + t.text}>
                <Link href={t.href} className="flex items-center justify-between gap-3 border-t border-white/25 py-3 first:border-t-0 transition active:opacity-70 motion-reduce:transition-none">
                  <span>{t.text}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasNoServices && (
        <Link href="/menu" className="w-full rounded-card bg-surface p-5 text-left shadow-sm transition active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100">
          <p className="text-lg text-foreground">先放上幾個服務吧 🌱</p>
          <p className="mt-1 text-sm text-muted">到「我的菜單」放上你願意為{partner}提供的服務,{partner}才能邀請你喔 →</p>
        </Link>
      )}

      {wishes.length > 0 && (
        <section className="w-full rounded-card bg-surface p-5 text-left shadow-sm">
          <h2 className="mb-3 text-lg text-foreground">離你最近的服務 ✨</h2>
          <div className="flex flex-col gap-4">
            {wishes.map((w) => (
              <div key={w.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground">
                    {w.emoji} {w.title}
                  </p>
                  <p className="shrink-0 text-sm text-muted">{w.price} 愛心</p>
                </div>
                <WishBar progress={w.progress} label={`${w.title} 的存愛心進度`} />
                <p className="text-xs text-muted">還差 {w.gap} 愛心就能邀請囉</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {ongoing > 0 && (
        <Link href="/orders" className="text-sm text-muted underline">
          還有 {ongoing} 個邀請進行中
        </Link>
      )}
      <Link href="/help" className="text-sm text-muted underline">
        有問題?問問愛愛小幫手 💬
      </Link>
    </main>
  );
}
