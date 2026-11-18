import { MAX_PRICE } from "@/lib/config";

export interface MenuTemplate {
  key: string;
  title: string;
  emoji: string;
  price: number;
}

/** 預設範本(SPEC 第 10 節)。套用後使用者可自行調整價格(可為 0)。 */
export const MENU_TEMPLATES: readonly MenuTemplate[] = [
  { key: "kiss", title: "親親", emoji: "💋", price: 100 },
  { key: "hug", title: "抱抱", emoji: "🤗", price: 200 },
  { key: "massage", title: "按摩", emoji: "💆", price: 600 },
  { key: "ride", title: "開車接送", emoji: "🚗", price: 400 },
];

export function findTemplate(key: string): MenuTemplate | undefined {
  return MENU_TEMPLATES.find((t) => t.key === key);
}

/** 還沒出現在我的菜單裡的範本(以名稱比對,不分前後空白) */
export function unappliedTemplates(existingTitles: readonly string[]): MenuTemplate[] {
  const have = new Set(existingTitles.map((t) => t.trim()));
  return MENU_TEMPLATES.filter((t) => !have.has(t.title));
}

export const TEMPLATE_PRICE_LIMIT = MAX_PRICE;
