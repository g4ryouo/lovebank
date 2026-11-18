import type { LedgerReason } from "./types";

/** 畫面用的一筆帳(資料來自 ledger,訂單名稱用建立當下的快照,改菜單後不變) */
export interface LedgerRowInput {
  id: string;
  delta: number;
  reason: LedgerReason;
  period_key: string | null;
  note: string | null;
  created_at: string;
  orders: { title_snapshot: string; emoji_snapshot: string | null } | null;
}

export interface LedgerLine {
  id: string;
  title: string;
  detail: string | null;
  delta: number;
  /** 這筆之後的愛心餘額 */
  balanceAfter: number;
  createdAt: string;
}

/** 一筆帳的說明文字。用語依 CLAUDE.md:送出愛心、收下愛心。 */
export function describeEntry(e: LedgerRowInput, partner: string): { title: string; detail: string | null } {
  switch (e.reason) {
    case "initial":
      return { title: "配對禮 💙", detail: "你們配對成功了" };
    case "allowance":
      return { title: "零用愛心", detail: e.period_key };
    case "order": {
      const name = e.orders ? `${e.orders.emoji_snapshot ? `${e.orders.emoji_snapshot} ` : ""}${e.orders.title_snapshot}` : "服務";
      return { title: name, detail: e.delta < 0 ? `送出愛心給${partner}` : `收下${partner}的愛心` };
    }
    case "gift":
      return { title: e.delta < 0 ? `轉讓愛心給${partner} 🎁` : `${partner}轉讓給你的愛心 🎁`, detail: e.note };
    case "adjustment":
      return { title: "愛心調整", detail: e.note };
  }
}

/**
 * 由新到舊的帳,逐筆算出「這筆之後」的餘額。
 * 從目前的餘額倒推,所以即使只列出最近幾筆,數字也一定和餘額一致。
 */
export function toLedgerLines(entries: readonly LedgerRowInput[], balance: number, partner: string): LedgerLine[] {
  const lines: LedgerLine[] = [];
  let running = balance;
  for (const e of entries) {
    const d = describeEntry(e, partner);
    lines.push({ id: e.id, ...d, delta: e.delta, balanceAfter: running, createdAt: e.created_at });
    running -= e.delta;
  }
  return lines;
}

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
