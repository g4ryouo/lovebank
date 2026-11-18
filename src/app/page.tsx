import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getViewer } from "@/lib/auth/viewer";
import { signOutAction } from "@/lib/pairing/actions";

// 登入狀態因人而異,整頁都是動態內容:暫不要求即時顯示(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

export default async function Home() {
  const { supabase, me, couple } = await getViewer();
  if (!me || !couple?.paired_at) redirect("/pair");

  const { data: balance } = await supabase.from("balances").select("balance").maybeSingle();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-full max-w-sm rounded-card bg-primary-soft px-8 py-10 shadow-sm">
        <h1 className="text-3xl text-primary-strong">💙 {APP_NAME}</h1>
        <p className="mt-3 text-muted">嗨,{me.nickname}!你們已經配對成功囉</p>
        <p className="mt-6 text-sm text-muted">我的愛心</p>
        <p className="text-5xl text-primary-strong">{balance?.balance ?? 0}</p>
      </div>
      <Link
        href="/menu"
        className="w-full max-w-sm rounded-full bg-primary-strong px-6 py-4 text-lg text-white shadow-md transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        我的愛的菜單
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-muted underline">
          登出
        </button>
      </form>
    </main>
  );
}
