"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { decideLimitAction, requestLimitAction, setPartnerLimitAction, withdrawLimitAction, type CreditFormState } from "@/lib/credit/actions";
import { SubmitButton } from "./SubmitButton";

const initial: CreditFormState = {};
const inputClass =
  "w-full rounded-2xl border-2 border-primary-soft bg-white px-4 py-3 text-lg text-foreground outline-none transition placeholder:text-muted/40 focus:border-primary-strong";

function Status({ state }: { state: CreditFormState }) {
  return (
    <>
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
    </>
  );
}

export function RequestLimitForm({ max }: { max: number }) {
  const [state, action] = useActionState(requestLimitAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="req-limit">
        想預支多少愛心貸款額度?(0 到 {max})
      </label>
      <input id="req-limit" name="limit" inputMode="numeric" pattern="[0-9]*" required className={inputClass} placeholder="例如:500" />
      <label className="text-sm text-muted" htmlFor="req-reason">
        想對他說的話(選填)
      </label>
      <input id="req-reason" name="reason" maxLength={100} className={inputClass} placeholder="例如:這個月想多存一點" />
      <Status state={state} />
      <SubmitButton pendingText="正在送出…">送出申請</SubmitButton>
    </form>
  );
}

function DecideButton({ approve, label, variant }: { approve: boolean; label: string; variant: "primary" | "quiet" }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("approve") === String(approve);
  return (
    <button
      type="submit"
      name="approve"
      value={String(approve)}
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-lg transition active:scale-95 disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${
        variant === "primary" ? "bg-primary-strong text-white shadow-md" : "bg-transparent text-muted underline"
      }`}
    >
      {mine && <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />}
      {label}
    </button>
  );
}

export function DecideLimitForm({ id }: { id: string }) {
  const [state, action] = useActionState(decideLimitAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <DecideButton approve label="同意" variant="primary" />
      <DecideButton approve={false} label="婉拒" variant="quiet" />
      <Status state={state} />
    </form>
  );
}

export function WithdrawLimitForm({ id }: { id: string }) {
  const [state, action] = useActionState(withdrawLimitAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingText="正在撤回…">撤回這個申請</SubmitButton>
      <Status state={state} />
    </form>
  );
}

export function SetPartnerLimitForm({ partner, max, current }: { partner: string; max: number; current: number }) {
  const [state, action] = useActionState(setPartnerLimitAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="partner" value={partner} />
      <label className="text-sm text-muted" htmlFor="set-limit">
        把{partner}可預支的額度調成(0 到 {max})
      </label>
      <input id="set-limit" name="limit" inputMode="numeric" pattern="[0-9]*" required defaultValue={String(current)} className={inputClass} />
      <Status state={state} />
      <SubmitButton pendingText="正在調整…">調整可預支額度</SubmitButton>
    </form>
  );
}
