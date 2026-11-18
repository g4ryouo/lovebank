"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createOrderAction, type OrderFormState } from "@/lib/orders/actions";
import { SubmitButton } from "./SubmitButton";

const initial: OrderFormState = {};

/**
 * 建立訂單的按鈕。kind="want":我想要(我付愛心);kind="offer":我想為你做(對方付愛心)。
 * disabledText 有值時只顯示不可按的提示(愛心還不夠);最終仍以資料庫檢查為準。
 */
export function OrderButton({
  itemId,
  kind,
  partner,
  label,
  disabledText,
}: {
  itemId: string;
  kind: "want" | "offer";
  partner: string;
  label: string;
  disabledText?: string;
}) {
  const [state, action] = useActionState(createOrderAction, initial);

  if (disabledText) {
    return (
      <button type="button" disabled className="w-full rounded-full bg-primary-soft px-6 py-4 text-lg text-muted">
        {disabledText}
      </button>
    );
  }

  // 送出成功:按鈕鎖住(避免不小心重複邀請),並提供去看這個邀請的連結
  if (state.orderId) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" disabled className="w-full rounded-full bg-primary-soft px-6 py-4 text-lg text-primary-strong">
          已送出邀請 ✓
        </button>
        <p role="status" className="text-center text-sm text-primary-strong">
          {state.message}
        </p>
        <Link href={`/orders/${state.orderId}`} className="text-center text-sm text-primary-strong underline">
          去看這個邀請 →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="partner" value={partner} />
      <SubmitButton pendingText="正在送出…">{label}</SubmitButton>
      {state.error && (
        <p role="alert" className="text-center text-sm text-rose-500">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-center text-sm text-primary-strong">
          {state.message}
        </p>
      )}
    </form>
  );
}
