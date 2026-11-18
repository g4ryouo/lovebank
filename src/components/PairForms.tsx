"use client";

import { useActionState } from "react";
import { createCoupleAction, joinCoupleAction, type FormState } from "@/lib/pairing/actions";
import { SubmitButton } from "./SubmitButton";

const initial: FormState = {};
const inputClass =
  "w-full rounded-2xl border-2 border-primary-soft bg-white px-4 py-3 text-lg text-foreground outline-none transition placeholder:text-muted/40 focus:border-primary-strong";

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-center text-sm text-rose-500">
      {message}
    </p>
  );
}

export function CreateCoupleForm({ suggestedNickname }: { suggestedNickname: string }) {
  const [state, action] = useActionState(createCoupleAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="create-nickname">
        你的暱稱
      </label>
      <input id="create-nickname" name="nickname" defaultValue={state.values?.nickname ?? suggestedNickname} maxLength={20} required className={inputClass} placeholder="例如:小明" />
      <ErrorText message={state.error} />
      <SubmitButton pendingText="正在準備邀請碼…">建立我們這一對</SubmitButton>
    </form>
  );
}

export function JoinCoupleForm({ suggestedNickname }: { suggestedNickname: string }) {
  const [state, action] = useActionState(joinCoupleAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="join-code">
        對方給你的邀請碼
      </label>
      <input
        id="join-code"
        name="code"
        defaultValue={state.values?.code ?? ""}
        required
        maxLength={12}
        autoCapitalize="characters"
        autoComplete="off"
        className={`${inputClass} text-center tracking-[0.3em] uppercase`}
        placeholder="ABCD2345"
      />
      <label className="text-sm text-muted" htmlFor="join-nickname">
        你的暱稱
      </label>
      <input id="join-nickname" name="nickname" defaultValue={state.values?.nickname ?? suggestedNickname} maxLength={20} required className={inputClass} placeholder="例如:小美" />
      <ErrorText message={state.error} />
      <SubmitButton pendingText="正在加入…">加入對方的一對</SubmitButton>
    </form>
  );
}
