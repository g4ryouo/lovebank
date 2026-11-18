import { z } from "zod";

export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "給自己取個暱稱吧")
  .max(20, "暱稱最多 20 個字喔");

/** 邀請碼:8 碼,忽略大小寫與空白(實際字元集見資料庫 _new_invite_code) */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/, "邀請碼是 8 個英數字喔");

export const createCoupleSchema = z.object({ nickname: nicknameSchema });
export const joinCoupleSchema = z.object({ code: inviteCodeSchema, nickname: nicknameSchema });

/** 登入後要回去的路徑:只接受站內相對路徑,避免被導去別的網站 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
