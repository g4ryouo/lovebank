/** 完成時的小慶祝(彩帶)。規則是純函式,方便測試。 */
export const CELEBRATE_WINDOW_MS = 10 * 60 * 1000;
const COLORS = ["#7cc0f5", "#4a9ee0", "#ffd166", "#ff8fab", "#b8e0ff", "#9be7c4"];

/**
 * 只在「剛完成」(10 分鐘內)、這個瀏覽分頁還沒慶祝過、而且沒有開「減少動態效果」時慶祝,
 * 避免每次打開舊的邀請都放彩帶。
 */
export function shouldCelebrate(input: { status: string; completedAt: string | null; now: number; seen: boolean; reducedMotion: boolean }): boolean {
  if (input.status !== "completed" || !input.completedAt || input.seen || input.reducedMotion) return false;
  const age = input.now - new Date(input.completedAt).getTime();
  return age >= 0 && age <= CELEBRATE_WINDOW_MS;
}

export interface ConfettiPiece {
  left: number; // 起始水平位置(%)
  dx: number; // 飄移距離(rem)
  rot: number; // 旋轉角度(deg)
  delay: number; // 延遲(s)
  dur: number; // 掉落時間(s)
  color: string;
}

/** 固定的「偽隨機」:同樣的輸入產生同樣的彩帶(不依賴 Math.random,畫面穩定、可測試) */
export function confettiPieces(count = 28): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (n: number) => ((Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      left: Math.round(r(1) * 100),
      dx: Math.round((r(2) - 0.5) * 12),
      rot: Math.round(360 + r(3) * 540),
      delay: Math.round(r(4) * 60) / 100,
      dur: 1.8 + Math.round(r(5) * 10) / 10,
      color: COLORS[i % COLORS.length] ?? "#7cc0f5",
    };
  });
}
