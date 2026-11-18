import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** 瀏覽器端的 Supabase client(使用者身分,受 RLS 約束) */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
