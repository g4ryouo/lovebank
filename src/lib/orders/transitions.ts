"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ERROR_MESSAGES, GENERIC_ERROR, parseErrorCode } from "@/lib/errors";

export interface TransitionState {
  error?: string;
}

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "decline", "cancel", "mark_done", "confirm", "waive"]),
});

/** 訂單狀態轉換:一律經資料庫函式(權限、額度、冪等都由資料庫把關),這裡只負責轉呼叫與顯示溫暖訊息 */
export async function orderTransitionAction(_prev: TransitionState, formData: FormData): Promise<TransitionState> {
  const parsed = schema.safeParse({ id: formData.get("id"), action: formData.get("action") });
  if (!parsed.success) return { error: "找不到這個邀請,重新整理看看吧" };
  const { id, action } = parsed.data;

  const supabase = await createClient();
  const call = {
    accept: () => supabase.rpc("respond_order", { p_order_id: id, p_accept: true }),
    decline: () => supabase.rpc("respond_order", { p_order_id: id, p_accept: false }),
    cancel: () => supabase.rpc("cancel_order", { p_order_id: id }),
    mark_done: () => supabase.rpc("mark_done", { p_order_id: id }),
    confirm: () => supabase.rpc("confirm_order", { p_order_id: id }),
    waive: () => supabase.rpc("waive_order", { p_order_id: id }),
  }[action];

  const { error } = await call();
  if (error) {
    const code = parseErrorCode(error.message);
    if (!code) return { error: GENERIC_ERROR };
    if (code === "INSUFFICIENT_CREDIT") {
      // 隱私:動手做的人不該得知對方的愛心狀況,只說現在還不能接受
      const { data } = await supabase.auth.getClaims();
      const { data: order } = await supabase.from("orders").select("giver_id").eq("id", id).maybeSingle();
      if (order && order.giver_id === data?.claims?.sub) return { error: "這個邀請現在還不能接受,晚點再試試吧" };
    }
    return { error: ERROR_MESSAGES[code] };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  return {};
}
