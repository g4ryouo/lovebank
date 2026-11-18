import type { OrderStatus } from "@/lib/points/types";

export interface LabelOrder {
  status: OrderStatus;
  giver_id: string;
  receiver_id: string;
  initiated_by: string;
  price_snapshot: number;
  settled_amount: number | null;
}

/** 用語依 CLAUDE.md:送出愛心、收下愛心、婉拒;不暗示「付了就必須答應」 */
export function statusLabel(o: LabelOrder, me: string, partner: string): string {
  const iAmGiver = o.giver_id === me;
  const iInitiated = o.initiated_by === me;
  switch (o.status) {
    case "requested":
      return iInitiated ? `等${partner}回應` : "等你回應";
    case "accepted":
      return iAmGiver ? "進行中,做完記得按「做完了」" : `進行中,等${partner}完成`;
    case "done_by_giver":
      return iAmGiver ? `等${partner}確認` : `${partner}做完了,等你確認`;
    case "completed":
      return o.settled_amount === 0 ? "完成了 💙 這次免費" : "完成了 💙";
    case "declined":
      return "婉拒了";
    case "cancelled":
      return "已取消";
    case "expired":
      return "沒有回應,已過期";
  }
}

/** 「我是誰」一句話:你想請他做 / 他想請你做 */
export function whoText(o: Pick<LabelOrder, "giver_id">, me: string, partner: string): string {
  return o.giver_id === me ? `${partner}想請你做` : `你想請${partner}做`;
}

/** 愛心怎麼流動:做的人收下、被服務的人送出;免費就不流動 */
export function heartText(o: LabelOrder, me: string): string {
  const amount = o.status === "completed" ? (o.settled_amount ?? 0) : o.price_snapshot;
  if (amount === 0) return "免費";
  const iAmGiver = o.giver_id === me;
  if (o.status === "completed") return iAmGiver ? `收下了 ${amount} 愛心` : `送出了 ${amount} 愛心`;
  return iAmGiver ? `完成後你會收下 ${amount} 愛心` : `完成後你會送出 ${amount} 愛心`;
}

/** 分組:等我回應 / 進行中 / 已結束 */
export function groupOf(o: LabelOrder, me: string): "waiting-me" | "ongoing" | "done" {
  if (o.status === "requested") return o.initiated_by === me ? "ongoing" : "waiting-me";
  if (o.status === "done_by_giver") return o.receiver_id === me ? "waiting-me" : "ongoing";
  if (o.status === "accepted") return "ongoing";
  return "done";
}
