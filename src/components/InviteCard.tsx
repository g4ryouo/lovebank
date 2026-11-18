"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** 顯示邀請碼等對方加入;每 5 秒自動檢查一次是否已配對 */
export function InviteCard({ code, expiresAt }: { code: string; expiresAt: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪貼簿不可用時,使用者仍可手動選取邀請碼
    }
  }

  const message = `來愛愛銀行跟我配對吧!💙 邀請碼:${code}`;
  const shareUrl = `https://line.me/R/share?text=${encodeURIComponent(message)}`;
  const date = new Date(expiresAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-muted">把這組邀請碼傳給你的另一半</p>
      <button
        type="button"
        onClick={copy}
        aria-label="複製邀請碼"
        className="rounded-3xl bg-primary-soft px-8 py-5 text-4xl tracking-[0.25em] text-primary-strong transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {code}
      </button>
      <p aria-live="polite" className="h-5 text-sm text-muted">
        {copied ? "已複製 ✓" : "點一下可以複製"}
      </p>
      <a
        href={shareUrl}
        className="flex w-full items-center justify-center rounded-full bg-[#06C755] px-6 py-4 text-lg text-white shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        用 LINE 傳給對方
      </a>
      <p className="text-sm text-muted">等對方輸入後,這裡會自動變成配對成功 · 邀請碼到 {date} 前有效</p>
    </div>
  );
}
