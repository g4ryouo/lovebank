"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE_CHARS, MAX_TURNS } from "@/lib/ai/support";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = ["愛心怎麼賺?", "婉拒會扣愛心嗎?", "愛心貸款額度是什麼?", "邀請沒人回應會怎樣?"];
const GREETING = "嗨!我是愛愛小幫手 💙 玩法、規則、怎麼操作,都可以問我。";

export function HelpChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // 只送最近幾輪的對話內容,不含任何身分資料
        body: JSON.stringify({ messages: next.slice(-MAX_TURNS) }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (res.ok && data.reply) setMessages([...next, { role: "assistant", content: data.reply }]);
      else setError(data.error ?? "發生了一點小問題,再試一次吧");
    } catch {
      setError("網路好像不太穩,再試一次吧");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        <p className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-primary-soft px-4 py-3 text-foreground">{GREETING}</p>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-surface px-4 py-2 text-sm text-primary-strong shadow-sm transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <p
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 ${m.role === "user" ? "self-end rounded-tr-sm bg-primary-strong text-white" : "self-start rounded-tl-sm bg-primary-soft text-foreground"}`}
          >
            {m.content}
          </p>
        ))}
        {busy && (
          <p className="self-start rounded-2xl rounded-tl-sm bg-primary-soft px-4 py-3 text-muted" role="status">
            <span className="inline-flex gap-1" aria-label="小幫手正在想">
              <span className="animate-bounce motion-reduce:animate-none">•</span>
              <span className="animate-bounce [animation-delay:150ms] motion-reduce:animate-none">•</span>
              <span className="animate-bounce [animation-delay:300ms] motion-reduce:animate-none">•</span>
            </span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-rose-500">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="help-input" className="sr-only">
          想問什麼?
        </label>
        <input
          id="help-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="想問愛愛銀行的什麼呢?"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border-2 border-primary-soft bg-white px-5 py-3 text-lg text-foreground outline-none transition placeholder:text-muted/40 focus:border-primary-strong"
        />
        <button type="submit" disabled={busy || !text.trim()} className="shrink-0 rounded-full bg-primary-strong px-6 py-3 text-lg text-white shadow-md transition active:scale-95 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100">
          送出
        </button>
      </form>
      <p className="text-center text-xs text-muted">我只回答愛愛銀行的問題,也看不到你的帳號和愛心數量</p>
    </div>
  );
}
