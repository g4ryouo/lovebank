/**
 * Anthropic Messages API 的最小客戶端(僅限伺服器端使用;金鑰只從環境變數讀取,絕不進入 client bundle)。
 * 不新增套件:直接用 fetch。任何失敗(沒金鑰、逾時、HTTP 錯誤、非 JSON)都丟出 AiUnavailableError,
 * 由呼叫端轉成「AI 暫時無法審查 / 小幫手暫時休息」。
 */

export class AiUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AiUnavailableError";
  }
}

export interface AiDeps {
  fetchFn?: typeof fetch;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

const ENDPOINT = "https://api.anthropic.com/v1/messages";
export const DEFAULT_TIMEOUT_MS = 12_000;

export async function callMessagesApi(body: Record<string, unknown>, deps: AiDeps = {}): Promise<unknown> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = deps.model ?? process.env.AI_MODEL;
  if (!apiKey) throw new AiUnavailableError("no-api-key");
  if (!model) throw new AiUnavailableError("no-model");

  const fetchFn = deps.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchFn(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, ...body }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AiUnavailableError(`http-${res.status}`);
    return await res.json();
  } catch (e) {
    if (e instanceof AiUnavailableError) throw e;
    throw new AiUnavailableError(e instanceof Error && e.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}
