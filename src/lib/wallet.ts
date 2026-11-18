import { availableCredit, canAfford } from "@/lib/points/credit";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 我的愛心狀況:餘額與預留各查一次(只回本人的列,見 balances / reserved view)。
 * 這裡的 available 只用來在畫面預覽;權威檢查在資料庫函式。
 */
export async function getWallet(supabase: Supabase, creditLimit: number) {
  const [b, r] = await Promise.all([
    supabase.from("balances").select("balance").maybeSingle(),
    supabase.from("reserved").select("reserved").maybeSingle(),
  ]);
  const balance = b.data?.balance ?? 0;
  const reserved = r.data?.reserved ?? 0;
  return {
    balance,
    reserved,
    creditLimit,
    available: availableCredit(balance, creditLimit, reserved),
    canAfford: (price: number) => canAfford(balance, creditLimit, reserved, price),
  };
}
