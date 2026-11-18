"use client";

import { useActionState } from "react";
import { updateNicknameAction, type NicknameState } from "@/lib/profile/actions";
import { SubmitButton } from "./SubmitButton";

const initial: NicknameState = {};

export function NicknameForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateNicknameAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="nickname">
        新的暱稱(最多 20 個字)
      </label>
      <input
        id="nickname"
        name="nickname"
        defaultValue={current}
        maxLength={20}
        required
        className="w-full rounded-2xl border-2 border-primary-soft bg-white px-4 py-3 text-lg text-foreground outline-none transition focus:border-primary-strong"
      />
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
      <SubmitButton pendingText="正在儲存…">儲存暱稱</SubmitButton>
    </form>
  );
}
