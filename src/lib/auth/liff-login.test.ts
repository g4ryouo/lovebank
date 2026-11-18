import { describe, expect, it, vi } from "vitest";
import { liffUrl, signInWithLiff, type IdTokenSignIn, type LiffLike } from "./liff-login";

function fakeLiff(over: Partial<LiffLike> = {}): LiffLike {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    isInClient: vi.fn().mockReturnValue(true),
    isLoggedIn: vi.fn().mockReturnValue(true),
    login: vi.fn(),
    getIDToken: vi.fn().mockReturnValue("header.payload.sig"),
    ...over,
  };
}
const okSupabase = (): IdTokenSignIn => ({ signInWithIdToken: vi.fn().mockResolvedValue({ error: null }) });
const base = { liffId: "123-abc", redirectUri: "https://x.test/login" };

describe("signInWithLiff", () => {
  it("在 LINE 裡且已登入:用 ID token 向 Supabase 登入", async () => {
    const supabase = okSupabase();
    const res = await signInWithLiff({ liff: fakeLiff(), supabase, ...base });
    expect(res).toEqual({ status: "signed-in" });
    expect(supabase.signInWithIdToken).toHaveBeenCalledWith({ provider: "custom:line", token: "header.payload.sig" });
  });

  it("用正確的 LIFF ID 初始化", async () => {
    const liff = fakeLiff();
    await signInWithLiff({ liff, supabase: okSupabase(), ...base });
    expect(liff.init).toHaveBeenCalledWith({ liffId: "123-abc" });
  });

  it("不在 LINE 裡:不登入、不呼叫 Supabase,交給一般按鈕", async () => {
    const supabase = okSupabase();
    const res = await signInWithLiff({ liff: fakeLiff({ isInClient: () => false }), supabase, ...base });
    expect(res).toEqual({ status: "not-in-line" });
    expect(supabase.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("在 LINE 裡但尚未登入 LIFF:導去 liff.login 並帶回原頁", async () => {
    const liff = fakeLiff({ isLoggedIn: () => false });
    const supabase = okSupabase();
    const res = await signInWithLiff({ liff, supabase, ...base });
    expect(res).toEqual({ status: "redirecting" });
    expect(liff.login).toHaveBeenCalledWith({ redirectUri: "https://x.test/login" });
    expect(supabase.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("LIFF 初始化失敗:回報 init 錯誤", async () => {
    const liff = fakeLiff({ init: vi.fn().mockRejectedValue(new Error("bad liffId")) });
    expect(await signInWithLiff({ liff, supabase: okSupabase(), ...base })).toEqual({ status: "error", reason: "init" });
  });

  it("拿不到 ID token(例如沒勾 openid):回報 no-token,不呼叫 Supabase", async () => {
    const supabase = okSupabase();
    const res = await signInWithLiff({ liff: fakeLiff({ getIDToken: () => null }), supabase, ...base });
    expect(res).toEqual({ status: "error", reason: "no-token" });
    expect(supabase.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("Supabase 驗證失敗:回報 supabase 錯誤", async () => {
    const supabase: IdTokenSignIn = { signInWithIdToken: vi.fn().mockResolvedValue({ error: { message: "Bad ID token" } }) };
    expect(await signInWithLiff({ liff: fakeLiff(), supabase, ...base })).toEqual({ status: "error", reason: "supabase" });
  });
});

describe("liffUrl", () => {
  it("組出 LIFF 入口網址", () => expect(liffUrl("2012685826-S51nQPqk")).toBe("https://liff.line.me/2012685826-S51nQPqk"));
});
