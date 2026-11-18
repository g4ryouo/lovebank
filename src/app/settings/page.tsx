import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { touchCouple } from "@/lib/touch";
import { getWallet } from "@/lib/wallet";
import { GIFT_COOLDOWN_DAYS, MAX_CREDIT_LIMIT, MAX_GIFT_AMOUNT } from "@/lib/config";
import { giftCooldown } from "@/lib/gift/status";
import { GiftForm } from "@/components/GiftForm";
import { DecideLimitForm, RequestLimitForm, SetPartnerLimitForm, WithdrawLimitForm } from "@/components/CreditForms";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

/** 取得伺服器現在時間(獨立成函式,讓頁面元件保持純粹) */
const serverNow = () => new Date();

export default async function SettingsPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase);
  const [wallet, partnerRes, lastGift, requestsRes] = await Promise.all([
    getWallet(supabase, me.credit_limit),
    // 對方的額度本來就由我控制,所以讀得到(SPEC 第 9 節)
    supabase.from("profiles").select("nickname, credit_limit").neq("id", user.id).maybeSingle(),
    // 只讀得到自己的帳本:最近一次我送出的禮物
    supabase.from("ledger").select("created_at").eq("reason", "gift").lt("delta", 0).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("limit_requests").select("id, requester_id, requested_limit, reason, status, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";
  const partnerLimit = partnerRes.data?.credit_limit ?? 0;
  const requests = requestsRes.data ?? [];
  const myPending = requests.find((r) => r.requester_id === user.id && r.status === "pending");
  const theirPending = requests.find((r) => r.requester_id !== user.id && r.status === "pending");
  const myLast = requests.find((r) => r.requester_id === user.id && r.status !== "pending");

  // 可以送的上限:不能超過單次上限,也不能動用預留與信用額度(balance − reserved)
  const giftable = Math.max(0, Math.min(MAX_GIFT_AMOUNT, wallet.balance - wallet.reserved));
  const { cooling, nextAt } = giftCooldown(lastGift.data?.created_at ?? null, serverNow());
  const nextText = nextAt?.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <Link href="/" className="text-sm text-muted underline">
        ← 回首頁
      </Link>
      <h1 className="text-center text-3xl text-primary-strong">設定 💙</h1>

      <section className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-sm">
        <h2 className="text-xl text-foreground">愛心貸款額度 🌱</h2>
        <p className="text-sm text-muted">
          愛心不夠的時候,可以「預先使用」愛心貸款額度:先預支,之後賺到愛心再補回來。額度由對方決定,最多 {MAX_CREDIT_LIMIT}
        </p>
        <p className="text-muted">
          我可以預支的額度 <span className="text-xl text-primary-strong">{wallet.creditLimit}</span> · {partner}可以預支的額度{" "}
          <span className="text-xl text-primary-strong">{partnerLimit}</span>
        </p>

        {theirPending && (
          <div className="flex flex-col gap-3 rounded-2xl bg-primary-soft p-4">
            <p className="text-foreground">
              {partner}想把愛心貸款額度調成 <span className="text-primary-strong">{theirPending.requested_limit}</span>
            </p>
            {theirPending.reason && <p className="text-sm text-muted">「{theirPending.reason}」</p>}
            <DecideLimitForm id={theirPending.id} />
          </div>
        )}

        {myPending ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-primary-soft p-4">
            <p className="text-center text-sm text-muted">
              你想把愛心貸款額度調成 {myPending.requested_limit},正在等{partner}回應 💙
            </p>
            <WithdrawLimitForm id={myPending.id} />
          </div>
        ) : (
          <>
            {myLast && (
              <p className="text-sm text-muted">
                上一次申請 {myLast.requested_limit}:{myLast.status === "approved" ? "已經同意了 ✓" : myLast.status === "withdrawn" ? "你撤回了" : "婉拒了,沒有關係,之後還可以再申請"}
              </p>
            )}
            <h3 className="mt-2 text-lg text-foreground">想要預支我的愛心額度</h3>
            <RequestLimitForm max={MAX_CREDIT_LIMIT} />
          </>
        )}

        <h3 className="mt-4 text-lg text-foreground">直接調整{partner}可預支的額度</h3>
        <SetPartnerLimitForm partner={partner} max={MAX_CREDIT_LIMIT} current={partnerLimit} />
      </section>

      <section className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-sm">
        <h2 className="text-xl text-foreground">轉讓愛心給{partner} 🎁</h2>
        <p className="text-sm text-muted">
          想直接對{partner}佛心大發送?每次最多 {MAX_GIFT_AMOUNT} 顆,{GIFT_COOLDOWN_DAYS} 天可以轉讓一次。只能轉讓你自己有的愛心喔(不能預支額度)
        </p>
        <p className="text-sm text-muted">
          你現在最多可以轉讓 <span className="text-lg text-primary-strong">{giftable}</span> 顆
        </p>
        {cooling ? (
          <p className="rounded-2xl bg-primary-soft p-4 text-center text-sm text-muted">你最近已經轉讓過了,{nextText} 之後又可以轉讓囉 💙</p>
        ) : giftable === 0 ? (
          <p className="rounded-2xl bg-primary-soft p-4 text-center text-sm text-muted">愛心還不夠,再存一下吧</p>
        ) : (
          <GiftForm partner={partner} max={giftable} />
        )}
      </section>
    </main>
  );
}
