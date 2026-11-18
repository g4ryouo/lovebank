import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { touchCouple } from "@/lib/touch";
import { groupOf, heartText, statusLabel, whoText } from "@/lib/orders/labels";
import { AutoRefresh } from "@/components/AutoRefresh";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

const COLUMNS = "id, status, title_snapshot, emoji_snapshot, price_snapshot, settled_amount, giver_id, receiver_id, initiated_by, created_at";

export default async function OrdersPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase); // 補處理要先做,下面查到的才是最新狀態
  const [ordersRes, partnerRes] = await Promise.all([
    supabase.from("orders").select(COLUMNS).order("created_at", { ascending: false }).limit(60),
    supabase.from("profiles").select("nickname").neq("id", user.id).maybeSingle(),
  ]);
  const partner = partnerRes.data?.nickname ?? "對方";
  const orders = ordersRes.data ?? [];

  const groups = {
    "waiting-me": orders.filter((o) => groupOf(o, user.id) === "waiting-me"),
    ongoing: orders.filter((o) => groupOf(o, user.id) === "ongoing"),
    done: orders.filter((o) => groupOf(o, user.id) === "done").slice(0, 15),
  };

  const section = (title: string, list: typeof orders, empty: string, highlight = false) => (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg text-foreground">{title}</h2>
      {list.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {list.map((o, i) => (
        <Link
          key={o.id}
          href={`/orders/${o.id}`}
          style={{ ["--i" as string]: Math.min(i, 8) }}
          className={`fade-up flex flex-col gap-1 rounded-card p-5 shadow-sm transition active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${highlight ? "bg-primary-soft" : "bg-surface"}`}
        >
          <p className="text-xl text-foreground">
            {o.emoji_snapshot} {o.title_snapshot}
          </p>
          <p className="text-sm text-muted">{whoText(o, user.id, partner)}</p>
          <p className="text-sm text-primary-strong">{statusLabel(o, user.id, partner)}</p>
          <p className="text-xs text-muted">{heartText(o, user.id)}</p>
        </Link>
      ))}
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <AutoRefresh />
      <Link href="/" className="text-sm text-muted underline">
        ← 回首頁
      </Link>
      <h1 className="text-center text-3xl text-primary-strong">我們的邀請 💙</h1>
      {section("等我回應", groups["waiting-me"], "目前沒有要回應的,真輕鬆 ✨", true)}
      {section("進行中", groups.ongoing, "還沒有進行中的邀請")}
      {section("已結束", groups.done, "還沒有結束的邀請")}
    </main>
  );
}
