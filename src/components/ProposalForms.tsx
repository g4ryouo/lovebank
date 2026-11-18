"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { proposalAction, type ProposalActionState } from "@/lib/proposals/actions";
import type { ProposalUiAction } from "@/lib/proposals/actions-model";

const inputClass =
  "w-full rounded-2xl border-2 border-primary-soft bg-white px-4 py-3 text-lg text-foreground outline-none transition placeholder:text-muted/40 focus:border-primary-strong";

const spinner = <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />;

/** 呼叫伺服器 API(含 AI 審查,可能要等幾秒),顯示結果 */
async function postJson(url: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "發生了一點小問題,再試一次吧" };
  } catch {
    return { ok: false, error: "網路好像不太穩,再試一次吧" };
  }
}

export function NewProposalForm({ partner }: { partner: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const price = String(fd.get("price") ?? "").trim();
    setError(null);
    setDone(false);
    if (!/^\d+$/.test(price)) return setError("價格要是 0 以上的整數喔");
    setBusy(true);
    const r = await postJson("/api/proposals", { title: String(fd.get("title") ?? ""), emoji: String(fd.get("emoji") ?? ""), price: Number(price) });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? null);
    form.reset();
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted">想在{partner}的菜單加一個小心願?先送出提案,AI 會給一些參考意見,最後由{partner}決定喔</p>
      <div className="flex gap-3">
        <div className="w-20 shrink-0">
          <label className="text-sm text-muted" htmlFor="p-emoji">圖示</label>
          <input id="p-emoji" name="emoji" maxLength={8} className={`${inputClass} text-center`} placeholder="😀" />
        </div>
        <div className="flex-1">
          <label className="text-sm text-muted" htmlFor="p-title">小心願的名字</label>
          <input id="p-title" name="title" maxLength={40} required className={inputClass} placeholder="例如:幫我按摩" />
        </div>
      </div>
      <label className="text-sm text-muted" htmlFor="p-price">想開的價格(愛心,0 就是免費)</label>
      <input id="p-price" name="price" inputMode="numeric" pattern="[0-9]*" required className={inputClass} placeholder="例如:300" />
      {error && <p role="alert" className="text-center text-sm text-rose-500">{error}</p>}
      {done && <p role="status" className="text-center text-sm text-primary-strong">已經送出提案囉,等{partner}回應吧 💙</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-strong px-6 py-4 text-lg text-white shadow-md transition active:scale-95 disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100">
        {busy && spinner}
        {busy ? "AI 正在看看…" : "送出提案"}
      </button>
    </form>
  );
}

export function CounterForm({ id, currentPrice }: { id: string; currentPrice: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const price = String(new FormData(e.currentTarget).get("price") ?? "").trim();
    setError(null);
    if (!/^\d+$/.test(price)) return setError("價格要是 0 以上的整數喔");
    setBusy(true);
    const r = await postJson(`/api/proposals/${id}/counter`, { price: Number(price) });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? null);
    setOpen(false);
    router.refresh();
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-full bg-primary-soft px-6 py-4 text-lg text-primary-strong transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100">
        還價(只有一次機會)
      </button>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl bg-primary-soft p-4">
      <label className="text-sm text-muted" htmlFor={`c-${id}`}>你覺得多少愛心剛好?(目前 {currentPrice})</label>
      <input id={`c-${id}`} name="price" inputMode="numeric" pattern="[0-9]*" required className={inputClass} />
      {error && <p role="alert" className="text-center text-sm text-rose-500">{error}</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-strong px-6 py-3 text-lg text-white shadow-md transition active:scale-95 disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100">
        {busy && spinner}
        {busy ? "AI 正在看看…" : "送出還價"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted underline">先不要</button>
    </form>
  );
}

const LABEL: Record<Exclude<ProposalUiAction, "counter">, { text: string; variant: "primary" | "quiet" }> = {
  agree: { text: "同意", variant: "primary" },
  reject: { text: "婉拒", variant: "quiet" },
  accept_counter: { text: "接受還價", variant: "primary" },
  decline_counter: { text: "婉拒還價", variant: "quiet" },
  withdraw: { text: "撤回提案", variant: "quiet" },
};

function ActionButton({ value, text, variant }: { value: string; text: string; variant: "primary" | "quiet" }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("action") === value;
  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-lg transition active:scale-95 disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${variant === "primary" ? "bg-primary-strong text-white shadow-md" : "bg-transparent text-muted underline"}`}
    >
      {mine && <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />}
      {text}
    </button>
  );
}

/** 同意、婉拒、接受還價、撤回:經資料庫函式,按下後轉圈並禁用 */
export function ProposalButtons({ id, actions }: { id: string; actions: Exclude<ProposalUiAction, "counter">[] }) {
  const initial: ProposalActionState = {};
  const [state, action] = useActionState(proposalAction, initial);
  if (actions.length === 0) return null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {actions.map((a) => (
        <ActionButton key={a} value={a} text={LABEL[a].text} variant={LABEL[a].variant} />
      ))}
      {state.error && <p role="alert" className="text-center text-sm text-rose-500">{state.error}</p>}
    </form>
  );
}

