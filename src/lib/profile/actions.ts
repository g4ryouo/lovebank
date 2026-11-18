"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { nicknameSchema } from "@/lib/pairing/schemas";

export interface NicknameState {
  error?: string;
  message?: string;
}

/** 修改自己的暱稱:只能改自己的(RLS 與欄位授權只允許本人更新 nickname) */
export async function updateNicknameAction(_prev: NicknameState, formData: FormData): Promise<NicknameState> {
  const parsed = nicknameSchema.safeParse(formData.get("nickname"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "暱稱看起來不太對喔" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "請先登入喔" };

  const { data, error } = await supabase.from("profiles").update({ nickname: parsed.data }).eq("id", userId).select("id");
  if (error) return { error: friendlyError(error.message) };
  if (!data?.length) return { error: "找不到你的資料,重新整理看看吧" };

  revalidatePath("/", "layout");
  return { message: "已經改好囉 💙" };
}
