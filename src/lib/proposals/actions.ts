"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export interface ProposalActionState {
  error?: string;
}

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["agree", "reject", "accept_counter", "decline_counter", "withdraw"]),
});

/** 提案的回應:一律經資料庫函式(權限、狀態、成立時建立菜單項目都由資料庫處理) */
export async function proposalAction(_prev: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  const parsed = schema.safeParse({ id: formData.get("id"), action: formData.get("action") });
  if (!parsed.success) return { error: "找不到這個提案,重新整理看看吧" };
  const { id, action } = parsed.data;

  const supabase = await createClient();
  const call = {
    agree: () => supabase.rpc("respond_proposal", { p_id: id, p_action: "agree" }),
    reject: () => supabase.rpc("respond_proposal", { p_id: id, p_action: "reject" }),
    accept_counter: () => supabase.rpc("decide_counter", { p_id: id, p_accept: true }),
    decline_counter: () => supabase.rpc("decide_counter", { p_id: id, p_accept: false }),
    withdraw: () => supabase.rpc("withdraw_proposal", { p_id: id }),
  }[action];

  const { error } = await call();
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/proposals");
  revalidatePath("/menu");
  revalidatePath("/partner");
  revalidatePath("/");
  return {};
}
