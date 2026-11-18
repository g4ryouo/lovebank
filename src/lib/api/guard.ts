/**
 * API route 的共用防護(避免跨網站偽造請求):
 * - 必須是 JSON(跨站的表單送出無法帶 application/json)。
 * - 若帶有 Origin,必須與本站相同。
 */
export function checkRequest(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return { ok: false, status: 415, error: "請求格式不正確" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { ok: false, status: 403, error: "來源不被允許" };
  return { ok: true };
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
