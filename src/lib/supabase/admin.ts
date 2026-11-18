import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * admin client:使用 service role,繞過 RLS。**只能在伺服器端使用**,而且**只用來呼叫 internal_* 函式**
 * (AI 審查結果寫入、AI 次數預約)。呼叫前,route 必須先用 session 確認操作者身分。
 * 沒有設定金鑰時回傳 null(呼叫端要回覆「尚未設定」)。
 */
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client 只能在伺服器端使用");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
