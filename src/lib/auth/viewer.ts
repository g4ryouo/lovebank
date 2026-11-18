import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 目前登入者的配對狀態。RLS 讓使用者只能讀到自己情侶的資料。 */
export async function getViewer() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, nickname, couple_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: couple } = me?.couple_id
    ? await supabase
        .from("couples")
        .select("id, invite_code, invite_expires_at, paired_at")
        .eq("id", me.couple_id)
        .maybeSingle()
    : { data: null };

  const rawName: unknown = user.user_metadata?.name ?? user.user_metadata?.full_name;
  const suggestedNickname = typeof rawName === "string" ? rawName.slice(0, 20) : "";

  return { supabase, user, me, couple, suggestedNickname };
}
