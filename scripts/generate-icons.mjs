// 產生 App 圖示(PNG)。用 Playwright 的 Chromium 把 SVG 轉成圖片,不需要額外套件。
// 用法:node scripts/generate-icons.mjs   (雲端容器可加 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium)
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const HEART = "M50 86 C16 62 6 42 6 30 C6 17 16 9 28 9 C38 9 46 15 50 23 C54 15 62 9 72 9 C84 9 94 17 94 30 C94 42 84 62 50 86 Z";

// scale:愛心占畫面的比例。maskable 需要放在中間 80% 的安全區內。
const svg = ({ scale, rounded }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#cfe9ff"/><stop offset="1" stop-color="#7cc0f5"/>
    </linearGradient>
    <linearGradient id="heart" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eaf5ff"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="2.2" stdDeviation="2.4" flood-color="#2f78bf" flood-opacity=".35"/>
    </filter>
  </defs>
  <rect width="100" height="100" ${rounded ? 'rx="22"' : ""} fill="url(#bg)"/>
  <g transform="translate(${50 - 50 * scale} ${52 - 48 * scale}) scale(${scale})" filter="url(#soft)">
    <path d="${HEART}" fill="url(#heart)"/>
  </g>
</svg>`;

const jobs = [
  { file: "src/app/icon.png", size: 512, scale: 0.62, rounded: true },
  { file: "src/app/apple-icon.png", size: 180, scale: 0.62, rounded: false }, // iOS 不接受透明背景,圓角由系統處理
  { file: "public/icons/icon-192.png", size: 192, scale: 0.62, rounded: true },
  { file: "public/icons/icon-512.png", size: 512, scale: 0.62, rounded: true },
  { file: "public/icons/maskable-512.png", size: 512, scale: 0.5, rounded: false }, // 全版背景,愛心縮在安全區內
];

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.size, height: j.size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(j)}</body></html>`);
  const png = await page.screenshot({ omitBackground: true });
  writeFileSync(j.file, png);
  await page.close();
  console.log("OK", j.file, j.size);
}
await browser.close();
