import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { touchCouple } from "@/lib/touch";
import { getWallet } from "@/lib/wallet";
import { GIFT_COOLDOWN_DAYS, MAX_GIFT_AMOUNT } from "@/lib/config";
import { giftCooldown } from "@/lib/gift/status";
import { GiftForm } from "@/components/GiftForm";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

/** 取得伺服器現在時間(獨立成函式,讓頁面元件保持純粹) */
const serverNow = () => new Date();

export default async function SettingsPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase);
  const [wallet, partnerRes, lastGift] = await Promise.all([
    getWallet(supabase, me.credit_limit),
    supabase.from("profiles").select("nickname").neq("id", user.id).maybeSingle(),
    // 只讀得到自己的帳本:最近一次我送出的禮物
    supabase.from("ledger").select("created_at").eq("reason", "gift").lt("delta", 0).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";

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
        <h2 className="text-xl text-foreground">送愛心給{partner} 🎁</h2>
        <p className="text-sm text-muted">
          想直接對{partner}佛心大發送?每次最多 {MAX_GIFT_AMOUNT} 顆,{GIFT_COOLDOWN_DAYS} 天可以送一次。只能送你自己有的愛心喔
        </p>
        <p className="text-sm text-muted">
          你現在最多可以送 <span className="text-lg text-primary-strong">{giftable}</span> 顆
        </p>
        {cooling ? (
          <p className="rounded-2xl bg-primary-soft p-4 text-center text-sm text-muted">你最近已經送過了,{nextText} 之後又可以送囉 💙</p>
        ) : giftable === 0 ? (
          <p className="rounded-2xl bg-primary-soft p-4 text-center text-sm text-muted">愛心還不夠,再存一下吧</p>
        ) : (
          <GiftForm partner={partner} max={giftable} />
        )}
      </section>
    </main>
  );
}
