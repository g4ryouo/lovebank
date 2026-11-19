/**
 * 用假資料把每個頁面真的「跑出來」:檢查頁面內容合不合邏輯,
 * 並(設定 DUMP_HTML=目錄 時)把每一頁的 HTML 存下來,拿去截圖檢視版面。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FakeDb } from "@/test/fake-supabase";
import { IDS, VIEWER, scenario } from "@/test/scenario";

const h = vi.hoisted(() => ({ db: {} as FakeDb, viewer: {} as Record<string, unknown>, rpc: {} as Record<string, unknown>, anonymous: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, replace() {}, push() {} }),
  usePathname: () => "/",
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/viewer", async () => {
  const { fakeSupabase: f } = await import("@/test/fake-supabase");
  return { getViewer: async () => ({ ...h.viewer, supabase: f(h.db, h.rpc) }) };
});
vi.mock("@/lib/supabase/server", async () => {
  const { fakeSupabase: f } = await import("@/test/fake-supabase");
  return {
    createClient: async () => {
      const c = f(h.db, h.rpc);
      if (h.anonymous) c.auth.getUser = async () => ({ data: { user: null as unknown as { id: string } } });
      return c;
    },
  };
});

const DUMP = process.env.DUMP_HTML;
function setup(db: FakeDb = scenario(), viewer: Record<string, unknown> = VIEWER) {
  h.db = db;
  h.viewer = viewer;
}
async function render(name: string, node: Promise<React.ReactNode> | React.ReactNode) {
  const html = renderToStaticMarkup(await node);
  if (DUMP) {
    mkdirSync(DUMP, { recursive: true });
    writeFileSync(`${DUMP}/${name}.html`, html);
  }
  return html;
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("首頁", () => {
  it("顯示雙方、愛心、可用愛心、預留與額度", async () => {
    setup();
    const { default: Home } = await import("@/app/page");
    const t = text(await render("home", Home()));
    expect(t).toContain("G4Ry");
    expect(t).toContain("小恩恩");
    expect(t).toContain("2500");
    expect(t).toContain("可以用的 2400"); // 2500 + 500 額度 − 600 預留
    expect(t).toContain("預留中 600");
  });
  it("「等你處理」把所有輪到我的事列在一起,而且包含我要去做的服務", async () => {
    setup();
    const { default: Home } = await import("@/app/page");
    const html = await render("home", Home());
    const t = text(html);
    // 小恩恩邀請我(1)+ 我已接受、要去做(1)+ 他做完等我確認(1)= 3
    expect(t).toContain("3 個邀請等你處理");
    expect(t).toContain("1 個服務提案等你回應");
    expect(t).toContain("小恩恩想調整愛心貸款額度");
    expect(html).toContain('href="/orders"');
    expect(html).toContain('href="/proposals"');
  });
  it("沒有事情要處理時,不會出現「等你處理」", async () => {
    const db = scenario();
    db.orders = [];
    db.limit_requests = [];
    db.service_proposals = [];
    setup(db);
    const { default: Home } = await import("@/app/page");
    expect(text(await render("home-quiet", Home()))).not.toContain("等你處理");
  });
  it("不再堆一排和導覽列重複的按鈕、也沒有登出(登出在設定)", async () => {
    setup();
    const { default: Home } = await import("@/app/page");
    const t = text(await render("home", Home()));
    for (const dup of ["愛心貸款額度與轉讓愛心", "我們的邀請", "登出"]) expect(t).not.toContain(dup);
  });
  it("離你最近的服務:以可用愛心判斷(開車接送 2200 ≤ 可用 2400,已經可以邀請,不算)", async () => {
    setup();
    const { default: Home } = await import("@/app/page");
    const t = text(await render("home", Home()));
    expect(t).toContain("離你最近的服務");
    expect(t).toContain("出國旅行");
    expect(t).not.toContain("開車接送");
    expect(t).toContain("還差 6600 愛心就能邀請囉"); // 9000 − 可用 2400
    expect(t).not.toContain("願望");
  });
  it("剛開始、我的菜單是空的:引導先放上服務", async () => {
    const db = scenario();
    db.menu_items = (db.menu_items ?? []).filter((m) => m.owner_id !== "me");
    setup(db);
    const { default: Home } = await import("@/app/page");
    const t = text(await render("home-new", Home()));
    expect(t).toContain("先放上幾個服務吧");
  });
  it("已經有服務就不再顯示引導", async () => {
    setup();
    const { default: Home } = await import("@/app/page");
    expect(text(await render("home", Home()))).not.toContain("先放上幾個服務吧");
  });
});

describe("他的菜單", () => {
  it("只有他的服務,不混進我自己的菜單", async () => {
    setup();
    const { default: Partner } = await import("@/app/partner/page");
    const t = text(await render("partner", Partner()));
    expect(t).toContain("抱抱");
    expect(t).toContain("出國旅行");
    expect(t).not.toContain("我想為你提供的服務");
    expect(t).not.toContain("按摩 600 愛心");
  });
  it("進度條與按鈕不矛盾:能邀請的沒有進度條,不能邀請的才有", async () => {
    setup();
    const { default: Partner } = await import("@/app/partner/page");
    const html = await render("partner", Partner());
    expect((html.match(/role="progressbar"/g) ?? []).length).toBe(1); // 只有出國旅行(9000 > 可用 2400)
    expect(text(html)).toContain("還差 6600 愛心就能邀請囉");
    expect(text(html)).toContain("愛心還不夠,再存一下吧");
  });
  it("要動用貸款額度才能邀請的服務,會明講會預先使用多少", async () => {
    const db = scenario();
    db.balances = [{ user_id: "me", balance: 100 }];
    db.reserved = [{ user_id: "me", reserved: 0 }]; // 可用 = 100 + 500 = 600
    setup(db);
    const { default: Partner } = await import("@/app/partner/page");
    const html = await render("partner-loan", Partner());
    const t = text(html);
    expect(t).toContain("會預先使用 100 的愛心貸款額度"); // 抱抱 200 − 餘額 100
    expect(t).toContain("可以用的 600");
    expect(t).toContain("還差 1600 愛心就能邀請囉"); // 開車接送 2200 − 600
  });
  it("對方沒有服務時引導到提案,不是一片空白", async () => {
    const db = scenario();
    db.menu_items = (db.menu_items ?? []).filter((m) => m.owner_id !== "partner");
    setup(db);
    const { default: Partner } = await import("@/app/partner/page");
    const html = await render("partner-empty", Partner());
    expect(text(html)).toContain("還沒有放上服務");
    expect(html).toContain('href="/proposals"');
  });
  it("他有服務、但沒有我想要的時,也有提案的入口", async () => {
    setup();
    const { default: Partner } = await import("@/app/partner/page");
    expect(text(await render("partner", Partner()))).toContain("沒有你想要的服務嗎");
  });
});

describe("我的菜單", () => {
  it("每個啟用中的服務有「邀請」,暫停中的有「恢復」", async () => {
    setup();
    const { default: Menu } = await import("@/app/menu/page");
    const html = await render("menu", Menu());
    const t = text(html);
    expect(t).toContain("目前可以提供的服務");
    expect((t.match(/邀請小恩恩來享受/g) ?? []).length).toBe(2); // 按摩、愛愛
    expect(t).toContain("他接受、你做完、他確認後,你會收下 600 愛心"); // 說清楚愛心怎麼流動
    expect(t).toContain("恢復這個服務");
  });
});

describe("邀請列表與詳情", () => {
  it("分組正確,並顯示愛心流向", async () => {
    setup();
    const { default: Orders } = await import("@/app/orders/page");
    const html = await render("orders", Orders());
    const t = text(html);
    expect(t).toContain("我們的邀請");
    // 依標題把頁面切成各區塊;「等我處理」包含:對方邀請我、我要去做的、他做完等我確認的
    const sections = html.split("<section").map((x) => text(x.replace(/^[^>]*>/, "")));
    const waiting = sections.find((x) => x.trimStart().startsWith("等我處理")) ?? "";
    const ongoing = sections.find((x) => x.trimStart().startsWith("進行中")) ?? "";
    expect(waiting).toContain("按摩");
    expect(waiting).toContain("洗車");
    expect(waiting).toContain("進行中,做完記得按「做完了」");
    expect(ongoing).toContain("等小恩恩回應"); // 我發起、在等他的,才是單純的進行中
    expect(ongoing).not.toContain("做完記得按");
  });
  const states: [string, string][] = [
    ["waitingMe", "orders-waiting-me"],
    ["accepted", "orders-accepted"],
    ["doneByMe", "orders-done-by-giver"],
    ["completed", "orders-completed"],
    ["mineRequested", "orders-mine-requested"],
  ];
  for (const [key, file] of states) {
    it(`詳情:${file}`, async () => {
      setup();
      const { default: Detail } = await import("@/app/orders/[id]/page");
      const html = await render(file, Detail({ params: Promise.resolve({ id: IDS[key as keyof typeof IDS] }) }));
      expect(text(html)).toContain("回邀請列表");
    });
  }
});

describe("設定、提案、帳本、配對、小幫手、登入", () => {
  it("設定:有暱稱、貸款額度、轉讓、捷徑與登出", async () => {
    setup();
    const { default: Settings } = await import("@/app/settings/page");
    const t = text(await render("settings", Settings()));
    for (const must of ["我的暱稱", "G4Ry", "修改暱稱", "愛心貸款額度", "預先使用", "想要預支我的愛心額度", "直接調整小恩恩可預支的額度", "轉讓愛心給小恩恩", "我的愛心帳本", "想要小恩恩提供的服務", "愛愛小幫手", "登出"]) {
      expect(t, must).toContain(must);
    }
  });
  it("提案:主要動作「同意」在「還價」之前,「婉拒」在最後", async () => {
    setup();
    const { default: Proposals } = await import("@/app/proposals/page");
    const html = await render("proposals", Proposals());
    const agree = html.indexOf(">同意<");
    const counter = html.indexOf("還價(只有一次機會)");
    const reject = html.indexOf(">婉拒<");
    expect(agree).toBeGreaterThan(-1);
    expect(counter).toBeGreaterThan(agree);
    expect(reject).toBeGreaterThan(counter);
  });
  it("帳本", async () => {
    setup();
    const { default: Ledger } = await import("@/app/ledger/page");
    const html = await render("ledger", Ledger());
    expect(text(html)).toContain("轉讓愛心給小恩恩");
  });
  it("登入頁:有個資說明,而且內容與實際保存的資料一致(不能寫「不保留任何個資」)", async () => {
    setup();
    h.anonymous = true; // 登入頁只給「還沒登入」的人看
    const { default: Login } = await import("@/app/login/page");
    const html = await render("login", Login({ searchParams: Promise.resolve({}) }));
    h.anonymous = false;
    const t = text(html);
    expect(t).toContain("只用來記錄你們的愛心進度");
    expect(t).toContain("請安心使用");
    expect(t).toContain("我們會保存哪些資料");
    // 如實說明:會保存的、不會保存的、AI 的部分
    for (const must of ["LINE 提供的名稱與大頭貼", "你取的暱稱", "愛心與邀請紀錄", "電話、地址", "對話內容", "送給 AI"]) expect(t, must).toContain(must);
    // 不能出現與事實不符的絕對說法
    expect(t).not.toContain("不會保留任何個資");
    expect(t).not.toContain("不保留任何個資");
    expect(t).not.toContain("沒有保存任何");
  });
  it("小幫手", async () => {
    const { default: Help } = await import("@/app/help/page");
    await render("help", Help());
  });
  it("配對:等待對方加入", async () => {
    const v = { ...VIEWER, couple: { ...VIEWER.couple, paired_at: null } };
    setup(scenario(), v);
    const { default: Pair } = await import("@/app/pair/page");
    await render("pair-waiting", Pair());
  });
  it("配對:還沒建立", async () => {
    setup(scenario(), { ...VIEWER, me: null, couple: null });
    const { default: Pair } = await import("@/app/pair/page");
    await render("pair-new", Pair());
  });
});
