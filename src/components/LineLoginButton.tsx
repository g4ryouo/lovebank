"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** 整頁導向的 LINE 登入(不用 popup,iOS 主畫面 PWA 才能正常運作) */
export function LineLoginButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "custom:line",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#06C755] px-6 py-4 text-lg text-white shadow-md transition active:scale-95 disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {busy && (
          <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
        )}
        {busy ? "正在帶你去 LINE…" : "用 LINE 登入"}
      </button>
      {failed && (
        <p role="alert" className="mt-3 text-center text-sm text-rose-500">
          登入沒有成功,再試一次吧
        </p>
      )}
    </div>
  );
}
