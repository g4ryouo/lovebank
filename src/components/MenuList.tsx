"use client";

import { useOptimistic, useTransition } from "react";
import { setActiveAction } from "@/lib/menu/actions";
import { EditItemForm } from "./MenuForms";
import { OrderButton } from "./OrderButton";

export interface MenuItemView {
  id: string;
  title: string;
  emoji: string | null;
  price: number;
  active: boolean;
}

const priceText = (p: number) => (p === 0 ? "免費" : `${p} 愛心`);

/** 暫停與恢復採「樂觀更新」:按下去立刻移動,伺服器在背景存檔(失敗會自動還原) */
export function MenuList({ items, partner }: { items: MenuItemView[]; partner: string }) {
  const [view, setOptimistic] = useOptimistic(items, (state, change: { id: string; active: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, active: change.active } : i)),
  );
  const [, startTransition] = useTransition();

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      setOptimistic({ id, active });
      const fd = new FormData();
      fd.set("id", id);
      fd.set("active", String(active));
      await setActiveAction(fd);
    });
  }

  const active = view.filter((i) => i.active);
  const inactive = view.filter((i) => !i.active);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg text-foreground">目前可以提供的服務</h2>
        {active.length === 0 && <p className="text-sm text-muted">還沒有服務,先從上面一鍵加入,或自己新增一個吧</p>}
        {active.map((item) => (
          <article key={item.id} className="rounded-card bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl text-foreground">
                {item.emoji} {item.title}
              </p>
              <p className="shrink-0 text-lg text-primary-strong">{priceText(item.price)}</p>
            </div>
            <p className="mt-2 text-xs text-muted">
              {item.price === 0 ? "這個服務是免費的" : `他接受、你做完、他確認後,你會收下 ${item.price} 愛心`}
            </p>
            <div className="mt-3">
              <OrderButton itemId={item.id} kind="offer" partner={partner} label={`邀請${partner}來享受`} />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">修改</summary>
              <EditItemForm item={item} />
            </details>
            <button type="button" onClick={() => toggle(item.id, false)} className="mt-3 text-sm text-muted underline">
              先暫停這個服務
            </button>
          </article>
        ))}
      </section>

      {inactive.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg text-foreground">暫停中(他看不到)</h2>
          {inactive.map((item) => (
            <article key={item.id} className="rounded-card bg-surface/70 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl text-muted">
                  {item.emoji} {item.title}
                </p>
                <p className="shrink-0 text-muted">{priceText(item.price)}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(item.id, true)}
                className="mt-3 w-full rounded-full bg-primary-strong px-6 py-3 text-lg text-white shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                恢復這個服務
              </button>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
