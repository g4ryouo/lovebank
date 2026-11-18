"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { giftSchema } from "./schemas";

export interface GiftFormState {
  error?: string;
  message?: string;
}

/** 贈送愛心:一律經資料庫函式 send_gift(單次上限、每人每週一次、不可用信用額度都由資料庫把關) */
export async function sendGiftAction(_prev: GiftFormState, formData: FormData): Promise<GiftFormState> {
  const parsed = giftSchema.safeParse({ amount: formData.get("amount"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "資料看起來不太對喔" };
  const partner = String(formData.get("partner") ?? "對方").slice(0, 20);

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_gift", { p_amount: parsed.data.amount, p_note: parsed.data.note ?? undefined });
  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/settings");
  revalidatePath("/");
  return { message: `已經把 ${parsed.data.amount} 顆愛心轉讓給 ${partner} 囉 💙` };
}
