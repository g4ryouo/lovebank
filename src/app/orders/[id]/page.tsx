import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { touchCouple } from "@/lib/touch";
import { heartText, statusLabel, whoText } from "@/lib/orders/labels";
import { availableOrderActions, toOrderLike } from "@/lib/points/order-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderActionButtons } from "@/components/OrderActionButtons";
import { CelebrateOnce } from "@/components/Confetti";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  await touchCouple(supabase); // 補處理要先做,下面查到的才是最新狀態
  const [orderRes, partnerRes] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("nickname").neq("id", user.id).maybeSingle(),
  ]);
  const order = orderRes.data;
  if (!order) notFound();
  const partner = partnerRes.data?.nickname ?? "對方";

  const actions = availableOrderActions(toOrderLike(order), user.id, new Date());
  const amount = order.price_snapshot;
  const iAmGiver = order.giver_id === user.id;

  const lines: [string, string | null][] = [
    ["送出邀請", when(order.created_at)],
    ["接受", when(order.accepted_at)],
    ["做完了", when(order.done_at)],
    ["完成", when(order.completed_at)],
  ];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <AutoRefresh />
      <CelebrateOnce id={order.id} status={order.status} completedAt={order.completed_at} />
      <Link href="/orders" className="text-sm text-muted underline">
        ← 回邀請列表
      </Link>

      <header className="rounded-card bg-primary-soft p-6 text-center shadow-sm">
        <p className="text-5xl" aria-hidden>
          {order.emoji_snapshot ?? "💙"}
        </p>
        <h1 className="mt-2 text-3xl text-primary-strong">{order.title_snapshot}</h1>
        <p className="mt-2 text-muted">{whoText(order, user.id, partner)}</p>
        <p className="mt-3 text-lg text-foreground">{statusLabel(order, user.id, partner)}</p>
        <p className="mt-1 text-sm text-muted">{heartText(order, user.id)}</p>
      </header>

      {order.note && (
        <p className="rounded-card bg-surface p-4 text-sm text-foreground shadow-sm">「{order.note}」</p>
      )}

      <OrderActionButtons id={order.id} actions={actions} amount={iAmGiver ? 0 : amount} status={order.status} />

      {order.status === "done_by_giver" && order.auto_confirm_at && !iAmGiver && (
        <p className="text-center text-xs text-muted">如果沒有回應,{when(order.auto_confirm_at)} 會自動確認</p>
      )}
      {order.status === "requested" && order.expires_at && (
        <p className="text-center text-xs text-muted">{when(order.expires_at)} 前沒有回應,這個邀請會自動過期,不會有任何影響</p>
      )}

      <ul className="flex flex-col gap-1 text-sm text-muted">
        {lines.filter(([, t]) => t).map(([label, t]) => (
          <li key={label} className="flex justify-between">
            <span>{label}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
