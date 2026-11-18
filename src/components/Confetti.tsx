"use client";

import { useEffect, useState } from "react";
import { confettiPieces, shouldCelebrate } from "@/lib/celebrate";

const SHOW_MS = 3200;

/**
 * 完成時放一次彩帶:只在剛完成、這個分頁還沒放過、且沒開「減少動態效果」時出現。
 * 彩帶不擋操作(pointer-events-none),幾秒後自動消失。
 */
export function CelebrateOnce({ id, status, completedAt }: { id: string; status: string; completedAt: string | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `celebrated:${id}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
    } catch {
      // 無痕模式等情況無法使用 sessionStorage:當作沒看過
    }
    const go = shouldCelebrate({
      status,
      completedAt,
      now: Date.now(),
      seen,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    if (!go) return;
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // 忽略
    }
    // 用計時器設定狀態(不在 effect 內同步設定),彩帶幾秒後自動消失
    const start = setTimeout(() => setShow(true), 0);
    const stop = setTimeout(() => setShow(false), SHOW_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [id, status, completedAt]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {confettiPieces().map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: `${p.left}%`, background: p.color, ["--dx" as string]: `${p.dx}rem`, ["--rot" as string]: `${p.rot}deg`, ["--delay" as string]: `${p.delay}s`, ["--dur" as string]: `${p.dur}s` }}
        />
      ))}
    </div>
  );
}
