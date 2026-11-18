import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 目前登入者的配對狀態。RLS 讓使用者只能讀到自己情侶的資料。
 * 效能:身分以 getClaims 在本機驗證 JWT(不用再問一次 Auth 伺服器),
 * 個人資料與情侶合併成一次查詢。
 */
export async function getViewer() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");
  const userId = claims.sub;

  const { data: me } = await supabase
    .from("profiles")
    .select("id, nickname, couple_id, credit_limit, couples(id, invite_code, invite_expires_at, paired_at)")
    .eq("id", userId)
    .maybeSingle();
  const couple = me?.couples ?? null;

  const meta = claims.user_metadata as Record<string, unknown> | undefined;
  const rawName: unknown = meta?.name ?? meta?.full_name;
  const suggestedNickname = typeof rawName === "string" ? rawName.slice(0, 20) : "";

  return { supabase, user: { id: userId }, me, couple, suggestedNickname };
}
