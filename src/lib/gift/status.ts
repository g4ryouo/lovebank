import { GIFT_COOLDOWN_DAYS } from "@/lib/config";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GiftCooldown {
  cooling: boolean;
  /** 冷卻結束、可以再送的時間;沒送過則為 null */
  nextAt: Date | null;
}

/** 最近一次送出禮物的時間 → 還在不在冷卻期(僅供畫面預覽,權威檢查在 send_gift) */
export function giftCooldown(lastGiftAt: string | Date | null, now: Date): GiftCooldown {
  if (!lastGiftAt) return { cooling: false, nextAt: null };
  const nextAt = new Date(new Date(lastGiftAt).getTime() + GIFT_COOLDOWN_DAYS * DAY_MS);
  return { cooling: nextAt.getTime() > now.getTime(), nextAt };
}
