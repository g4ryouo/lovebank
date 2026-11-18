import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getWallet } from "@/lib/wallet";
import { wishProgress } from "@/lib/points/progress";
import { OrderButton } from "@/components/OrderButton";
import { WishBar } from "@/components/WishBar";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

const priceText = (p: number) => (p === 0 ? "免費" : `${p} 愛心`);

export default async function PartnerPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  const [wallet, partnerRes, theirItems] = await Promise.all([
    getWallet(supabase, me.credit_limit),
    supabase.from("profiles").select("nickname").neq("id", user.id).maybeSingle(),
    // RLS:對方的項目只讀得到啟用中的
    supabase.from("menu_items").select("id, title, emoji, price").neq("owner_id", user.id).order("created_at", { ascending: true }),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";
  const wants = theirItems.data ?? [];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <Link href="/" className="text-sm text-muted underline">
        ← 回首頁
      </Link>
      <header className="text-center">
        <h1 className="text-3xl text-primary-strong">{partner}的愛的菜單 💙</h1>
        <p className="mt-2 text-sm text-muted">看看有什麼服務想請他提供吧。他做完後,你會送出愛心喔</p>
        <p className="mt-1 text-xs text-muted">想主動為他提供服務?到「我的菜單」,每個服務旁邊都有邀請按鈕</p>
        <p className="mt-3 text-muted">
          我的愛心 <span className="text-xl text-primary-strong">{wallet.balance}</span>
          {wallet.available !== wallet.balance && <span className="block text-sm">可以用的 {wallet.available}</span>}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {wants.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-card bg-primary-soft p-6 text-center">
            <p className="text-3xl" aria-hidden>
              🍽️
            </p>
            <p className="text-lg text-foreground">{partner}還沒有放上服務</p>
            <p className="text-sm text-muted">你可以先提出「想要他提供的服務」,經過{partner}同意後,就會出現在他的菜單裡</p>
            <Link
              href="/proposals"
              className="mt-1 w-full rounded-full bg-primary-strong px-6 py-4 text-lg text-white shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              想要他提供的服務 ✨
            </Link>
          </div>
        )}
        {wants.map((item, i) => {
          // 「能不能邀請」以可用愛心(餘額 + 貸款額度 − 預留)為準,進度條與按鈕才不會互相矛盾
          const affordable = wallet.canAfford(item.price);
          const usesLoan = affordable && item.price > wallet.balance;
          return (
            <article key={item.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="fade-up flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl text-foreground">
                  {item.emoji} {item.title}
                </p>
                <p className="shrink-0 text-lg text-primary-strong">{priceText(item.price)}</p>
              </div>
              {!affordable && (
                <div className="flex flex-col gap-1">
                  <WishBar progress={wishProgress(wallet.available, item.price)} label={`${item.title} 的存愛心進度`} />
                  <p className="text-xs text-muted">還差 {item.price - wallet.available} 愛心就能邀請囉</p>
                </div>
              )}
              {usesLoan && <p className="text-xs text-muted">會預先使用 {item.price - Math.max(wallet.balance, 0)} 的愛心貸款額度</p>}
              <OrderButton
                itemId={item.id}
                kind="want"
                partner={partner}
                label="我想要"
                disabledText={affordable ? undefined : "愛心還不夠,再存一下吧"}
              />
            </article>
          );
        })}
      </section>

      {wants.length > 0 && (
        <Link href="/proposals" className="rounded-card bg-primary-soft p-5 text-center text-sm text-primary-strong">
          沒有你想要的服務嗎?提出「想要{partner}提供的服務」→
        </Link>
      )}
    </main>
  );
}
