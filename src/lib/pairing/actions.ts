"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { createCoupleSchema, joinCoupleSchema } from "./schemas";

export interface FormState {
  error?: string;
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "資料看起來不太對喔";

export async function createCoupleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createCoupleSchema.safeParse({ nickname: formData.get("nickname") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_couple", { p_nickname: parsed.data.nickname });
  if (error) return { error: friendlyError(error.message) };
  redirect("/pair");
}

export async function joinCoupleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = joinCoupleSchema.safeParse({
    code: formData.get("code"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_couple", {
    p_code: parsed.data.code,
    p_nickname: parsed.data.nickname,
  });
  if (error) return { error: friendlyError(error.message) };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
