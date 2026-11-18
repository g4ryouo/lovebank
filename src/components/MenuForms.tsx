"use client";

import { useActionState } from "react";
import { createItemAction, updateItemAction, type MenuFormState } from "@/lib/menu/actions";
import { SubmitButton } from "./SubmitButton";

const initial: MenuFormState = {};
const inputClass =
  "w-full rounded-2xl border-2 border-primary-soft bg-white px-4 py-3 text-lg text-foreground outline-none transition placeholder:text-muted/40 focus:border-primary-strong";

function Fields({ idKey, defaults }: { idKey: string; defaults?: { title: string; emoji: string | null; price: number } }) {
  return (
    <>
      <div className="flex gap-3">
        <div className="w-20 shrink-0">
          <label className="text-sm text-muted" htmlFor={`emoji-${idKey}`}>
            圖示
          </label>
          <input id={`emoji-${idKey}`} name="emoji" defaultValue={defaults?.emoji ?? ""} maxLength={8} className={`${inputClass} text-center`} placeholder="😀" />
        </div>
        <div className="flex-1">
          <label className="text-sm text-muted" htmlFor={`title-${idKey}`}>
            服務的名字
          </label>
          <input id={`title-${idKey}`} name="title" defaultValue={defaults?.title ?? ""} maxLength={40} required className={inputClass} placeholder="例如:幫你按摩" />
        </div>
      </div>
      <label className="text-sm text-muted" htmlFor={`price-${idKey}`}>
        價格(愛心,0 就是免費)
      </label>
      <input id={`price-${idKey}`} name="price" inputMode="numeric" pattern="[0-9]*" defaultValue={defaults ? String(defaults.price) : ""} required className={inputClass} placeholder="例如:300" />
    </>
  );
}

function Status({ state }: { state: MenuFormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-center text-sm text-rose-500">
        {state.error}
      </p>
    );
  if (state.ok) return <p className="text-center text-sm text-primary-strong">已經存好了 ✓</p>;
  return null;
}

export function AddItemForm() {
  const [state, action] = useActionState(createItemAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Fields idKey="new" />
      <Status state={state} />
      <SubmitButton pendingText="正在加進菜單…">加進我的菜單</SubmitButton>
    </form>
  );
}

export function EditItemForm({ item }: { item: { id: string; title: string; emoji: string | null; price: number } }) {
  const [state, action] = useActionState(updateItemAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />
      <Fields idKey={item.id} defaults={item} />
      <Status state={state} />
      <SubmitButton pendingText="正在儲存…">儲存修改</SubmitButton>
    </form>
  );
}
