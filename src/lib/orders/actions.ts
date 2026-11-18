"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export interface OrderFormState {
  error?: string;
  message?: string;
}

const idSchema = z.string().uuid();

/**
 * 建立訂單(只經資料庫函式 create_order)。
 * 對方的項目 → 我是接受者(「我想要」,我付愛心,建立時檢查額度);
 * 我自己的項目 → 我是提供者(「我想為你做」,對方付愛心,不檢查對方額度)。
 * 兩種情況由資料庫依項目擁有者判斷,client 不能指定身分。
 */
export async function createOrderAction(_prev: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const id = idSchema.safeParse(formData.get("item_id"));
  if (!id.success) return { error: "找不到這個小心願,重新整理看看吧" };
  const kind = formData.get("kind") === "offer" ? "offer" : "want";
  const partner = String(formData.get("partner") ?? "對方").slice(0, 20);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_order", { p_menu_item_id: id.data });
  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/partner");
  revalidatePath("/");
  return {
    message:
      kind === "want"
        ? `已經邀請 ${partner} 囉,等他回應吧 💙`
        : `已經告訴 ${partner} 你想為 TA 做這件事囉,等他回應吧 💙`,
  };
}
