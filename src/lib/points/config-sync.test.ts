import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as config from "@/lib/config";

// 資料庫函式內的規則常數(0004 的 _cfg)必須與 config.ts 一致。
describe("SQL 規則常數與 config.ts 同步", () => {
  const sql = readFileSync("supabase/migrations/0004_functions_core.sql", "utf8");
  const cfg = new Map<string, number>();
  for (const m of sql.matchAll(/when '([A-Z_]+)' then (\d+)/g)) cfg.set(m[1] ?? "", Number(m[2]));

  it("AUTO_CONFIRM_HOURS", () => expect(cfg.get("AUTO_CONFIRM_HOURS")).toBe(config.AUTO_CONFIRM_HOURS));
  it("REQUEST_EXPIRE_DAYS", () => expect(cfg.get("REQUEST_EXPIRE_DAYS")).toBe(config.REQUEST_EXPIRE_DAYS));
  it("ALLOWANCE_CATCH_UP_DAYS", () =>
    expect(cfg.get("ALLOWANCE_CATCH_UP_DAYS")).toBe(config.ALLOWANCE_CATCH_UP_DAYS));
  it("沒有多餘的 SQL 常數", () => expect(cfg.size).toBe(3));
});
