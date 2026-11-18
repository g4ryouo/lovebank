import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** 介面用詞統一(docs/DESIGN.md):畫面文字不得出現舊用詞或冷冰冰的金融用語 */
const BANNED: [RegExp, string][] = [
  [/小心願/, "請用「服務」(菜單上的一項)或「邀請」(一次往來)"],
  [/訂單/, "請用「邀請」"],
  [/扣款|付款/, "請用「送出愛心」"],
  [/拒絕/, "請用「婉拒」"],
  [/餘額不足/, "請用「愛心還不夠,再存一下吧」"],
  [/交易/, "請用「送出愛心 / 收下愛心」"],
  [/購買/, "請用「邀請 / 想要」"],
  [/送愛心/, "請用「轉讓愛心」(「送出愛心」只用在完成邀請時的付出)"],
  [/信用額度/, "請用「愛心貸款額度」"],
  [/\bTA\b/, "請用「他」或暱稱"],
];

/** AI 提示詞裡會「列出不要用的詞」當作指示,所以這兩個檔案可以出現這些詞(但「小心願」「訂單」仍不行) */
const PROMPT_FILES = new Set(["src/lib/ai/support.ts", "src/lib/ai/review.ts"]);
const ALLOWED_IN_PROMPTS = new Set(["扣款|付款", "拒絕", "\\bTA\\b"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !p.endsWith("database.ts")) out.push(p);
  }
  return out;
}

/** 拿掉註解(程式碼註解可以講「訂單」這類內部名詞,只檢查會顯示給使用者的文字) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

describe("介面用詞統一", () => {
  const files = walk("src");
  it("有檢查到檔案", () => expect(files.length).toBeGreaterThan(30));

  for (const [re, advice] of BANNED) {
    it(`畫面文字不使用 ${re.source}`, () => {
      const offenders = files
        .map((f) => ({ f, text: stripComments(readFileSync(f, "utf8")) }))
        .filter(({ f }) => !(PROMPT_FILES.has(f) && ALLOWED_IN_PROMPTS.has(re.source)))
        .filter(({ text }) => re.test(text))
        .map(({ f }) => f);
      expect(offenders, `${advice};出現在:${offenders.join(", ")}`).toEqual([]);
    });
  }
});

describe("主要用詞都有出現(確保沒有改丟)", () => {
  const all = walk("src").map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");
  for (const term of ["目前可以提供的服務", "想要他提供的服務", "我們的邀請", "愛心貸款額度", "預先使用", "想要預支我的愛心額度", "直接調整", "可預支的額度", "轉讓愛心", "我想要", "我想為你做", "愛心還不夠,再存一下吧", "婉拒"]) {
    it(`有「${term}」`, () => expect(all).toContain(term));
  }
});
