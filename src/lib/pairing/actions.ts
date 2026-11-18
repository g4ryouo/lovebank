"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { createCoupleSchema, joinCoupleSchema } from "./schemas";

export interface FormState {
  error?: string;
  /** 送出失敗時保留使用者輸入的內容(React 在送出後會清空表單) */
  values?: { code?: string; nickname?: string };
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "資料看起來不太對喔";

export async function createCoupleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { nickname: formData.get("nickname") };
  const values = { nickname: typeof raw.nickname === "string" ? raw.nickname : "" };
  const parsed = createCoupleSchema.safeParse(raw);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_couple", { p_nickname: parsed.data.nickname });
  if (error) return { error: friendlyError(error.message), values };
  redirect("/pair");
}

export async function joinCoupleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { code: formData.get("code"), nickname: formData.get("nickname") };
  const values = {
    code: typeof raw.code === "string" ? raw.code : "",
    nickname: typeof raw.nickname === "string" ? raw.nickname : "",
  };
  const parsed = joinCoupleSchema.safeParse(raw);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_couple", {
    p_code: parsed.data.code,
    p_nickname: parsed.data.nickname,
  });
  if (error) return { error: friendlyError(error.message), values };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
