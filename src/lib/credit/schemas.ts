import { z } from "zod";
import { MAX_CREDIT_LIMIT } from "@/lib/config";

/** 愛心額度:0 到 MAX_CREDIT_LIMIT 的整數 */
export const limitSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "額度要是 0 以上的整數喔")
  .transform(Number)
  .pipe(z.number().int().min(0).max(MAX_CREDIT_LIMIT, `額度最多 ${MAX_CREDIT_LIMIT} 喔`));

export const requestLimitSchema = z.object({
  limit: limitSchema,
  reason: z
    .string()
    .trim()
    .max(100, "想說的話最多 100 個字喔")
    .transform((v) => (v === "" ? null : v)),
});

export const decideSchema = z.object({
  id: z.string().uuid(),
  approve: z.enum(["true", "false"]).transform((v) => v === "true"),
});
