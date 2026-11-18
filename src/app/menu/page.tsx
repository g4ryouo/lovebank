import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { applyTemplateAction } from "@/lib/menu/actions";
import { unappliedTemplates } from "@/lib/menu/templates";
import { AddItemForm } from "@/components/MenuForms";
import { MenuList } from "@/components/MenuList";
import { SubmitButton } from "@/components/SubmitButton";

// 內容因人而異,整頁都是動態內容(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

export default async function MenuPage() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  const { data } = await supabase
    .from("menu_items")
    .select("id, title, emoji, price, active, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  const items = data ?? [];
  const templates = unappliedTemplates(items.map((i) => i.title));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted underline">
          ← 回首頁
        </Link>
      </div>
      <header className="text-center">
        <h1 className="text-3xl text-primary-strong">我的愛的菜單 💙</h1>
        <p className="mt-2 text-sm text-muted">放上你願意為對方做的事,對方就可以邀請你囉</p>
      </header>

      {templates.length > 0 && (
        <section className="rounded-card bg-primary-soft p-5">
          <h2 className="mb-3 text-lg text-foreground">一鍵加入</h2>
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <form key={t.key} action={applyTemplateAction}>
                <input type="hidden" name="key" value={t.key} />
                <SubmitButton pendingText="加入中…">
                  {t.emoji} {t.title} · {t.price} 愛心
                </SubmitButton>
              </form>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">加入之後,價格都可以自己調整喔</p>
        </section>
      )}

      <MenuList items={items} />

      <section className="rounded-card bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg text-foreground">自己新增一個</h2>
        <AddItemForm />
      </section>
    </main>
  );
}
