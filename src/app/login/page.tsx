import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { safeNext } from "@/lib/pairing/schemas";
import { createClient } from "@/lib/supabase/server";
import { LoginPanel } from "@/components/LoginPanel";

// 登入狀態因人而異,整頁都是動態內容:暫不要求即時顯示(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-sm rounded-card bg-primary-soft px-8 py-10 text-center shadow-sm">
        <div className="text-5xl" aria-hidden>
          💙
        </div>
        <h1 className="mt-3 text-3xl text-primary-strong">{APP_NAME}</h1>
        <p className="mt-2 text-muted">給兩個人的愛心小銀行</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-4">
        {params.error && (
          <p role="alert" className="text-center text-sm text-rose-500">
            登入沒有成功,再試一次吧
          </p>
        )}
        <LoginPanel next={next} />
        <p className="text-center text-xs text-muted">登入就代表你願意和另一半一起收集愛心</p>
      </div>
    </main>
  );
}
