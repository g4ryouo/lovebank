"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { friendlyError } from "@/lib/errors";
import { activeSchema, menuItemSchema, menuItemWithIdSchema } from "./schemas";
import { findTemplate } from "./templates";

export interface MenuFormState {
  error?: string;
  ok?: boolean;
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "資料看起來不太對喔";

/** 取得已配對的目前使用者;沒配對就回到配對頁。寫入一律經 RLS(只能動自己的項目)。 */
async function requireOwner() {
  const { supabase, user, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");
  return { supabase, userId: user.id, coupleId: me.couple_id as string };
}

function readItemFields(formData: FormData) {
  return {
    title: formData.get("title"),
    emoji: formData.get("emoji") ?? "",
    price: formData.get("price"),
  };
}

export async function createItemAction(_prev: MenuFormState, formData: FormData): Promise<MenuFormState> {
  const parsed = menuItemSchema.safeParse(readItemFields(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, userId, coupleId } = await requireOwner();
  const { error } = await supabase
    .from("menu_items")
    .insert({ couple_id: coupleId, owner_id: userId, ...parsed.data });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/menu");
  return { ok: true };
}

export async function updateItemAction(_prev: MenuFormState, formData: FormData): Promise<MenuFormState> {
  const parsed = menuItemWithIdSchema.safeParse({ ...readItemFields(formData), id: formData.get("id") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase, userId } = await requireOwner();
  const { id, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from("menu_items")
    .update(fields)
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id");
  if (error) return { error: friendlyError(error.message) };
  if (!data?.length) return { error: "找不到這個服務,重新整理看看吧" };
  revalidatePath("/menu");
  return { ok: true };
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const parsed = activeSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return;
  const { supabase, userId } = await requireOwner();
  await supabase.from("menu_items").update({ active: parsed.data.active }).eq("id", parsed.data.id).eq("owner_id", userId);
  revalidatePath("/menu");
}

export async function applyTemplateAction(formData: FormData): Promise<void> {
  const template = findTemplate(String(formData.get("key") ?? ""));
  if (!template) return;
  const { supabase, userId, coupleId } = await requireOwner();
  await supabase
    .from("menu_items")
    .insert({ couple_id: coupleId, owner_id: userId, title: template.title, emoji: template.emoji, price: template.price });
  revalidatePath("/menu");
}
