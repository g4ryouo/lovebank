import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 進入頁面時的「讀取時補處理」(SPEC 5.4):補發零用愛心、自動確認逾時訂單、標記過期邀請。
 * 冪等;失敗不影響頁面顯示(下次進來會再處理)。
 */
export async function touchCouple(supabase: Supabase): Promise<void> {
  try {
    await supabase.rpc("touch_couple");
  } catch {
    // 忽略:不讓補處理的問題擋住頁面
  }
}
