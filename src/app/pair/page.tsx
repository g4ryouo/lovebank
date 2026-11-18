import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { InviteCard } from "@/components/InviteCard";
import { CreateCoupleForm, JoinCoupleForm } from "@/components/PairForms";

// 登入狀態因人而異,整頁都是動態內容:暫不要求即時顯示(T13 再以 Suspense 與骨架畫面優化)
export const instant = false;

export default async function PairPage() {
  const { me, couple, suggestedNickname } = await getViewer();
  if (couple?.paired_at) redirect("/");

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-6">
      <h1 className="mt-6 text-3xl text-primary-strong">找到另一半 💙</h1>

      {me && couple ? (
        <section className="w-full max-w-sm rounded-card bg-surface p-6 shadow-sm">
          <InviteCard code={couple.invite_code} expiresAt={couple.invite_expires_at} />
        </section>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-6">
          <section className="rounded-card bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-xl text-foreground">我來建立</h2>
            <CreateCoupleForm suggestedNickname={suggestedNickname} />
          </section>
          <p className="text-center text-muted">或者</p>
          <section className="rounded-card bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-xl text-foreground">我有邀請碼</h2>
            <JoinCoupleForm suggestedNickname={suggestedNickname} />
          </section>
        </div>
      )}
    </main>
  );
}
