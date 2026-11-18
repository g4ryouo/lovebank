"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { orderTransitionAction, type TransitionState } from "@/lib/orders/transitions";
import type { UiOrderAction } from "@/lib/points/order-actions";

const initial: TransitionState = {};

const STYLE: Record<"primary" | "soft" | "quiet", string> = {
  primary: "bg-primary-strong text-white shadow-md",
  soft: "bg-primary-soft text-primary-strong",
  quiet: "bg-transparent text-muted underline",
};

function ActionButton({ value, label, variant }: { value: UiOrderAction; label: string; variant: "primary" | "soft" | "quiet" }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("action") === value;
  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-lg transition active:scale-95 disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${STYLE[variant]}`}
    >
      {mine && (
        <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
      )}
      {label}
    </button>
  );
}

const BUTTONS: Record<UiOrderAction, { label: (ctx: Ctx) => string; variant: "primary" | "soft" | "quiet" }> = {
  accept: { label: () => "接受", variant: "primary" },
  decline: { label: () => "婉拒", variant: "quiet" },
  mark_done: { label: () => "做完了", variant: "primary" },
  confirm: { label: (c) => (c.amount > 0 ? `確認,送出 ${c.amount} 愛心` : "確認"), variant: "primary" },
  waive: { label: () => "這次免費", variant: "soft" },
  cancel: { label: () => "取消這個邀請", variant: "quiet" },
};

interface Ctx {
  amount: number;
  status: string;
}

/** 依角色與狀態決定的按鈕;每個按鈕按下後轉圈並禁用整組,避免重複點擊(資料庫也保證冪等) */
export function OrderActionButtons({ id, actions, amount, status }: { id: string; actions: UiOrderAction[]; amount: number; status: string }) {
  const [state, action] = useActionState(orderTransitionAction, initial);
  if (actions.length === 0) return null;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {actions.map((a) => (
        <ActionButton key={a} value={a} label={BUTTONS[a].label({ amount, status })} variant={BUTTONS[a].variant} />
      ))}
      {actions.includes("waive") && (
        <p className="text-center text-xs text-muted">「這次免費」:這次不收愛心,雙方的愛心都不會變</p>
      )}
      {state.error && (
        <p role="alert" className="text-center text-sm text-rose-500">
          {state.error}
        </p>
      )}
    </form>
  );
}
