"use client";

import { useFormStatus } from "react-dom";

/** 送出按鈕:按下有彈性、送出中顯示轉圈並禁止重複點擊(尊重「減少動態效果」設定) */
export function SubmitButton({ children, pendingText = "稍等一下…" }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-strong px-6 py-4 text-lg text-white shadow-md transition active:scale-95 disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {pending && (
        <span
          aria-hidden
          className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
        />
      )}
      {pending ? pendingText : children}
    </button>
  );
}
