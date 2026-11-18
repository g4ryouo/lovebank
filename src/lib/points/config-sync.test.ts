import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as config from "@/lib/config";

// 資料庫函式內的規則常數(_cfg,取最後一次定義)必須與 config.ts 一致。
function latestCfg(): Map<string, number> {
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let body = "";
  for (const f of files) {
    const sql = readFileSync(`${dir}/${f}`, "utf8");
    const m = sql.match(/function public\._cfg\(p_key text\)[\s\S]*?\$\$;/);
    if (m) body = m[0];
  }
  const cfg = new Map<string, number>();
  for (const m of body.matchAll(/when '([A-Z_]+)' then (\d+)/g)) cfg.set(m[1] ?? "", Number(m[2]));
  return cfg;
}

describe("SQL 規則常數與 config.ts 同步", () => {
  const cfg = latestCfg();
  it("AUTO_CONFIRM_HOURS", () => expect(cfg.get("AUTO_CONFIRM_HOURS")).toBe(config.AUTO_CONFIRM_HOURS));
  it("REQUEST_EXPIRE_DAYS", () => expect(cfg.get("REQUEST_EXPIRE_DAYS")).toBe(config.REQUEST_EXPIRE_DAYS));
  it("ALLOWANCE_CATCH_UP_DAYS", () => expect(cfg.get("ALLOWANCE_CATCH_UP_DAYS")).toBe(config.ALLOWANCE_CATCH_UP_DAYS));
  it("INVITE_CODE_TTL_DAYS", () => expect(cfg.get("INVITE_CODE_TTL_DAYS")).toBe(config.INVITE_CODE_TTL_DAYS));
  it("MAX_GIFT_AMOUNT", () => expect(cfg.get("MAX_GIFT_AMOUNT")).toBe(config.MAX_GIFT_AMOUNT));
  it("GIFT_COOLDOWN_DAYS", () => expect(cfg.get("GIFT_COOLDOWN_DAYS")).toBe(config.GIFT_COOLDOWN_DAYS));
  it("MAX_CREDIT_LIMIT", () => expect(cfg.get("MAX_CREDIT_LIMIT")).toBe(config.MAX_CREDIT_LIMIT));
  it("沒有多餘的 SQL 常數", () => expect(cfg.size).toBe(7));
});
