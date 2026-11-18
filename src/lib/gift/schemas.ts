import { z } from "zod";
import { MAX_GIFT_AMOUNT } from "@/lib/config";

export const giftSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+$/, "愛心數量要是大於 0 的整數喔")
    .transform(Number)
    .pipe(z.number().int().min(1, "至少要送 1 顆愛心喔").max(MAX_GIFT_AMOUNT, `每次最多送 ${MAX_GIFT_AMOUNT} 顆愛心喔`)),
  note: z
    .string()
    .trim()
    .max(40, "想說的話最多 40 個字喔")
    .transform((v) => (v === "" ? null : v)),
});
