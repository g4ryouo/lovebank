import { NextResponse } from "next/server";
import { safeNext } from "@/lib/pairing/schemas";
import { createClient } from "@/lib/supabase/server";

/** LINE 登入完成後,Supabase 會帶著 code 回到這裡,換成 session 再導向 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
