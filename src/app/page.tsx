import { APP_NAME } from "@/lib/config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-card bg-primary-soft px-8 py-10 shadow-sm">
        <h1 className="text-4xl text-primary-strong">💙 {APP_NAME}</h1>
        <p className="mt-3 text-muted">給兩個人的愛心小銀行</p>
      </div>
    </main>
  );
}
