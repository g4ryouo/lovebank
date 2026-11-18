/**
 * LIFF 自動登入:在 LINE 裡面打開網站時,取得 LINE 的 ID token,交給 Supabase 驗證後登入。
 * 為了好測試,LIFF 與 Supabase 都以介面注入(實際使用見 components/LoginPanel.tsx)。
 * ID token 的簽章、發行者、受眾與期限都由 Supabase 驗證,這裡不自己解析。
 */

export interface LiffLike {
  init(config: { liffId: string }): Promise<void>;
  isInClient(): boolean;
  isLoggedIn(): boolean;
  login(config?: { redirectUri?: string }): void;
  getIDToken(): string | null;
}

export interface IdTokenSignIn {
  signInWithIdToken(params: { provider: `custom:${string}`; token: string }): Promise<{ error: { message: string } | null }>;
}

export type LiffLoginResult =
  | { status: "signed-in" }
  /** 不是在 LINE 裡面打開:交給一般的「用 LINE 登入」按鈕 */
  | { status: "not-in-line" }
  /** 已呼叫 liff.login,頁面即將被帶走 */
  | { status: "redirecting" }
  | { status: "error"; reason: "init" | "no-token" | "supabase" };

export async function signInWithLiff(deps: {
  liff: LiffLike;
  supabase: IdTokenSignIn;
  liffId: string;
  redirectUri: string;
}): Promise<LiffLoginResult> {
  const { liff, supabase, liffId, redirectUri } = deps;
  try {
    await liff.init({ liffId });
  } catch {
    return { status: "error", reason: "init" };
  }

  if (!liff.isInClient()) return { status: "not-in-line" };

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri });
    return { status: "redirecting" };
  }

  const token = liff.getIDToken();
  if (!token) return { status: "error", reason: "no-token" };

  const { error } = await supabase.signInWithIdToken({ provider: "custom:line", token });
  if (error) return { status: "error", reason: "supabase" };
  return { status: "signed-in" };
}

/** 在 LINE 裡打開網站的入口網址(LIFF URL) */
export function liffUrl(liffId: string): string {
  return `https://liff.line.me/${liffId}`;
}
