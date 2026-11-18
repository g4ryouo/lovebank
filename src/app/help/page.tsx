import Link from "next/link";
import { HelpChat } from "@/components/HelpChat";

export default function HelpPage() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-sm flex-col gap-4 p-6">
      <Link href="/" className="text-sm text-muted underline">
        ← 回首頁
      </Link>
      <h1 className="text-center text-3xl text-primary-strong">愛愛小幫手 💬</h1>
      <HelpChat />
    </main>
  );
}
