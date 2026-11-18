import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

/** 讀 PNG 檔頭取得寬高 */
function pngSize(path: string) {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("Web App Manifest(可加入主畫面)", () => {
  const m = manifest();
  it("名稱、全螢幕、起始頁、語言", () => {
    expect(m.name).toBe("愛愛銀行");
    expect(m.short_name).toBe("愛愛銀行");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.lang).toBe("zh-Hant");
  });
  it("背景色與主題色是淺藍色系", () => {
    expect(m.background_color).toBe("#f3f9ff");
    expect(m.theme_color).toBe("#f3f9ff");
  });
  it("有 192 與 512 的一般圖示,以及 512 的 maskable 圖示", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  });
  it("每個圖示檔案真的存在,而且尺寸和宣告的一致", () => {
    for (const i of m.icons ?? []) {
      const file = `public${i.src}`;
      expect(existsSync(file), file).toBe(true);
      const [w] = (i.sizes ?? "").split("x").map(Number);
      expect(pngSize(file)).toEqual({ w, h: w });
    }
  });
  it("iOS 主畫面圖示與網站圖示存在(180 與 512)", () => {
    expect(pngSize("src/app/apple-icon.png")).toEqual({ w: 180, h: 180 });
    expect(pngSize("src/app/icon.png")).toEqual({ w: 512, h: 512 });
  });
  it("不再使用範本留下的 Next.js 圖示", () => {
    expect(existsSync("src/app/favicon.ico")).toBe(false);
    for (const f of ["next.svg", "vercel.svg", "file.svg", "globe.svg", "window.svg"]) expect(existsSync(`public/${f}`)).toBe(false);
  });
});
