"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 畫面開著時,每隔幾秒悄悄更新一次,對方做了什麼就看得到(頁面在背景時暫停) */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
