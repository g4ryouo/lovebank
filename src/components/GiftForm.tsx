"use client";

import { useActionState } from "react";
import { sendGiftAction, type GiftFormState } from "@/lib/gift/actions";
import { SubmitButton } from "./SubmitButton";

const initial: GiftFormState = {};
const inputClass =
  "w-full rounded-2xl border-2 border-primary-soft bg-white px-4 py-3 text-lg text-foreground outline-none transition placeholder:text-muted/40 focus:border-primary-strong";

export function GiftForm({ partner, max }: { partner: string; max: number }) {
  const [state, action] = useActionState(sendGiftAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="partner" value={partner} />
      <label className="text-sm text-muted" htmlFor="gift-amount">
        想送幾顆愛心(最多 {max})
      </label>
      <input id="gift-amount" name="amount" inputMode="numeric" pattern="[0-9]*" required className={inputClass} placeholder="例如:500" />
      <label className="text-sm text-muted" htmlFor="gift-note">
        想對他說的話(選填)
      </label>
      <input id="gift-note" name="note" maxLength={40} className={inputClass} placeholder="例如:謝謝你這週的照顧" />
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
      <SubmitButton pendingText="正在送出愛心…">送出愛心</SubmitButton>
    </form>
  );
}
