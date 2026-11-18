"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { liffUrl, signInWithLiff, type LiffLike } from "@/lib/auth/liff-login";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

type Phase = "checking" | "signing-in" | "button" | "error";

const spinner = (
  <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
);
const lineButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-full bg-[#06C755] px-6 py-4 text-lg text-white shadow-md transition active:scale-95 disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * 登入區:
 * - 在 LINE 裡打開(LIFF):自動登入,不用輸入帳號密碼。
 * - 在一般瀏覽器:顯示「用 LINE 登入」按鈕(整頁導向,不用 popup),並提示可改用 LINE 打開。
 */
export function LoginPanel({ next }: { next: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(LIFF_ID ? "checking" : "button");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!LIFF_ID || started.current) return;
    started.current = true;
    (async () => {
      const liff = (await import("@line/liff")).default as unknown as LiffLike;
      const result = await signInWithLiff({
        liff,
        supabase: createClient().auth,
        liffId: LIFF_ID,
        redirectUri: window.location.href,
      });
      if (result.status === "signed-in") {
        setPhase("signing-in");
        router.replace(next);
        router.refresh();
      } else if (result.status === "redirecting") {
        setPhase("signing-in");
      } else if (result.status === "not-in-line") {
        setPhase("button");
      } else if (result.reason === "init") {
        setPhase("button"); // LIFF 載入失敗:退回一般的整頁導向登入,仍然可用
      } else {
        setPhase("error");
        setMessage("登入沒有成功,再試一次吧");
      }
    })();
  }, [next, router]);

  async function signInWithRedirect() {
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "custom:line",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      setMessage("登入沒有成功,再試一次吧");
    }
  }

  if (phase === "checking" || phase === "signing-in") {
    return (
      <div role="status" className="flex w-full items-center justify-center gap-3 rounded-full bg-[#06C755] px-6 py-4 text-lg text-white shadow-md">
        {spinner}
        {phase === "checking" ? "稍等一下…" : "正在用 LINE 登入…"}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button type="button" onClick={signInWithRedirect} disabled={busy} className={lineButtonClass}>
        {busy && spinner}
        {busy ? "正在帶你去 LINE…" : phase === "error" ? "再試一次" : "用 LINE 登入"}
      </button>
      {message && (
        <p role="alert" className="text-center text-sm text-rose-500">
          {message}
        </p>
      )}
      {LIFF_ID && (
        <a href={liffUrl(LIFF_ID)} className="text-center text-sm text-primary-strong underline">
          手機有 LINE?用 LINE 打開,不用輸入密碼
        </a>
      )}
    </div>
  );
}
