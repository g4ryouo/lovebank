import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar, CouplePair } from "./Avatar";

const URL_OK = "https://profile.line-scdn.net/0abc/p";

describe("Avatar", () => {
  it("有網址:顯示圖片,不帶 referrer,沒有替代文字(裝飾用)", () => {
    const html = renderToStaticMarkup(<Avatar url={URL_OK} name="小明" />);
    expect(html).toContain(`src="${URL_OK}"`);
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('alt=""');
  });
  it("沒有網址:不放圖片,顯示暱稱的第一個字", () => {
    const html = renderToStaticMarkup(<Avatar url={null} name="小明" />);
    expect(html).not.toContain("<img");
    expect(html).toContain("小");
  });
  it("圖片底下一定有暱稱第一個字(圖片壞掉時會露出來)", () => {
    expect(renderToStaticMarkup(<Avatar url={URL_OK} name="Gary" />)).toContain("G");
  });
  it("暱稱是表情符號或空白也不會壞", () => {
    expect(renderToStaticMarkup(<Avatar url={null} name="💙小" />)).toContain("💙");
    expect(renderToStaticMarkup(<Avatar url={null} name="   " />)).toContain("💙");
  });
});

describe("CouplePair", () => {
  const html = renderToStaticMarkup(<CouplePair me={{ name: "小明", url: URL_OK }} partner={{ name: "小美", url: null }} />);
  it("顯示雙方的名字,我在左、對方在右", () => {
    expect(html.indexOf("小明")).toBeLessThan(html.indexOf("小美"));
  });
  it("中間有愛心,且尊重減少動態效果", () => {
    const mid = html.slice(html.indexOf("小明"), html.lastIndexOf("小美"));
    expect(mid).toContain("💙");
    expect(html).toContain("motion-reduce:animate-none");
  });
  it("只有有網址的那一位顯示圖片", () => expect((html.match(/<img/g) ?? []).length).toBe(1));
});
