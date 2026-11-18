import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverDeps } from "@/lib/proposals/server-deps";
import type { HandlerDeps } from "@/lib/proposals/handlers";
import { checkRequest, json } from "./guard";

type Ready = { ok: true; userId: string; deps: HandlerDeps; body: unknown } | { ok: false; response: Response };

/**
 * API route 的共同開頭:請求防護 → 以 session 確認操作者身分(之後才會碰 admin client)→ 讀取 JSON。
 * 沒設定 service role 金鑰時回 503(部署漏設環境變數)。
 */
export async function prepare(request: Request): Promise<Ready> {
  const guard = checkRequest(request);
  if (!guard.ok) return { ok: false, response: json(guard.status, { error: guard.error }) };

  const userDb = await createClient();
  const { data } = await userDb.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { ok: false, response: json(401, { error: "請先登入喔" }) };

  const admin = createAdminClient();
  if (!admin) return { ok: false, response: json(503, { error: "這個功能還沒設定好,晚點再試試吧" }) };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: json(400, { error: "資料格式不太對" }) };
  }
  return { ok: true, userId, deps: serverDeps(admin, userDb), body };
}
