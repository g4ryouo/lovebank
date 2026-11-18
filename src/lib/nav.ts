/** 底部導覽列:有哪些分頁、哪些頁面不顯示、目前在哪一頁 */
export const NAV_ITEMS = [
  { href: "/", label: "首頁", icon: "🏠" },
  { href: "/partner", label: "他的菜單", icon: "🍽️" },
  { href: "/orders", label: "邀請", icon: "💌" },
  { href: "/menu", label: "我的菜單", icon: "📖" },
  { href: "/settings", label: "設定", icon: "⚙️" },
] as const;

/** 這些頁面不顯示導覽列:登入與配對(還沒進到遊戲)、小幫手(整頁聊天) */
const HIDDEN_PREFIXES = ["/login", "/pair", "/help", "/auth"];

export function showNav(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 目前頁面屬於哪個分頁(子頁面歸在所屬分頁,例如 /orders/123 屬於「邀請」) */
export function activeTab(pathname: string): string | null {
  if (pathname === "/") return "/";
  const hit = NAV_ITEMS.find((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)));
  return hit?.href ?? null;
}
