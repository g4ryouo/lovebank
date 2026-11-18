import { GIFT_COOLDOWN_DAYS, MAX_GIFT_AMOUNT } from "@/lib/config";
import type { ErrorCode } from "@/lib/points/types";

/** 錯誤代碼(SPEC 第 8 節)對應的溫暖訊息。用語見 CLAUDE.md 用語表。 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NOT_PAIRED: "還沒配對成功喔,先找到你的另一半吧",
  INVITE_INVALID: "這組邀請碼好像不太對,或已經過期了。再確認一下,邀請碼 7 天內有效喔",
  COUPLE_FULL: "這一對已經有兩個人了,換一組邀請碼試試吧",
  INVALID_STATE: "這個動作現在做不了,看看最新的狀態吧",
  NOT_ALLOWED: "這個動作你現在不能做喔",
  ITEM_INACTIVE: "這個小心願暫時不開放了",
  INSUFFICIENT_CREDIT: "愛心還不夠,再存一下吧",
  INSUFFICIENT_BALANCE: "愛心還不夠,再存一下吧",
  INVALID_AMOUNT: "數字要是大於 0 的整數喔",
  ALREADY_PENDING: "已經有一筆在等回覆了",
  LIMIT_TOO_HIGH: "這個額度有點太高了,調低一點吧",
  AI_LIMIT: "今天問得有點多囉,明天再來找我吧 💙",
  GIFT_LIMIT: `佛心送愛心每次最多 ${MAX_GIFT_AMOUNT} 顆,而且 ${GIFT_COOLDOWN_DAYS} 天只能送一次喔`,
};

export const GENERIC_ERROR = "發生了一點小問題,再試一次吧";

const CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[];

/** 從資料庫例外訊息取出錯誤代碼(訊息本身就是代碼,例如 'COUPLE_FULL') */
export function parseErrorCode(message: string | null | undefined): ErrorCode | null {
  if (!message) return null;
  const hit = CODES.find((c) => message.trim() === c || message.includes(c));
  return hit ?? null;
}

/** 資料庫錯誤 → 給使用者看的訊息;不認識的錯誤一律顯示通用訊息(不洩漏內部細節) */
export function friendlyError(message: string | null | undefined): string {
  const code = parseErrorCode(message);
  return code ? ERROR_MESSAGES[code] : GENERIC_ERROR;
}
