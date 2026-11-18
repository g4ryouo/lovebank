"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { decideSchema, limitSchema, requestLimitSchema } from "./schemas";

export interface CreditFormState {
  error?: string;
  message?: string;
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "資料看起來不太對喔";

/** 提出額度申請(經資料庫函式 request_limit;每人同時只能有一筆待處理) */
export async function requestLimitAction(_prev: CreditFormState, formData: FormData): Promise<CreditFormState> {
  const parsed = requestLimitSchema.safeParse({ limit: formData.get("limit"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_limit", {
    p_requested_limit: parsed.data.limit,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/");
  return { message: "已經送出申請囉,等他回應吧 💙" };
}

/** 核准或婉拒對方的申請(經 decide_limit_request;核准者必須是另一方) */
export async function decideLimitAction(_prev: CreditFormState, formData: FormData): Promise<CreditFormState> {
  const parsed = decideSchema.safeParse({ id: formData.get("id"), approve: formData.get("approve") });
  if (!parsed.success) return { error: "找不到這個申請,重新整理看看吧" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_limit_request", { p_request_id: parsed.data.id, p_approve: parsed.data.approve });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/");
  return { message: parsed.data.approve ? "已經同意囉 💙" : "已經婉拒了,沒有任何影響" };
}

/** 直接調整對方的額度(經 set_credit_limit;只能設定對方,不能設定自己) */
export async function setPartnerLimitAction(_prev: CreditFormState, formData: FormData): Promise<CreditFormState> {
  const parsed = limitSchema.safeParse(formData.get("limit"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const partner = String(formData.get("partner") ?? "對方").slice(0, 20);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_credit_limit", { p_limit: parsed.data });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/");
  return { message: `已經把${partner}的額度調成 ${parsed.data} 囉 💙` };
}
