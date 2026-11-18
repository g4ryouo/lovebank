import { z } from "zod";
import { MAX_PRICE } from "@/lib/config";

export const titleSchema = z.string().trim().min(1, "給這個服務取個名字吧").max(40, "名字最多 40 個字喔");

/** emoji 選填:空字串視為沒有;長度限制避免塞入長文字 */
export const emojiSchema = z
  .string()
  .trim()
  .max(8, "圖示放一個表情符號就好囉")
  .transform((v) => (v === "" ? null : v));

/** 價格:0 到 MAX_PRICE 的整數(價格 0 代表免費) */
export const priceSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "價格要是 0 以上的整數喔")
  .transform(Number)
  .pipe(z.number().int().min(0, "價格不能是負的喔").max(MAX_PRICE, `價格最多 ${MAX_PRICE} 喔`));

export const menuItemSchema = z.object({ title: titleSchema, emoji: emojiSchema, price: priceSchema });
export const menuItemWithIdSchema = menuItemSchema.extend({ id: z.string().uuid() });
export const activeSchema = z.object({ id: z.string().uuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });
