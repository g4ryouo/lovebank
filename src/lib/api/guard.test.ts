import { describe, expect, it } from "vitest";
import { checkRequest } from "./guard";

const req = (headers: Record<string, string>) => new Request("https://app.example/api/x", { method: "POST", headers });

describe("checkRequest", () => {
  it("JSON 且同源 → 通過", () => {
    expect(checkRequest(req({ "content-type": "application/json", origin: "https://app.example" }))).toEqual({ ok: true });
    expect(checkRequest(req({ "content-type": "application/json; charset=utf-8" }))).toEqual({ ok: true });
  });
  it("不是 JSON → 415", () => {
    expect(checkRequest(req({ "content-type": "application/x-www-form-urlencoded" }))).toMatchObject({ ok: false, status: 415 });
    expect(checkRequest(req({}))).toMatchObject({ ok: false, status: 415 });
  });
  it("別的網站來的 → 403", () => {
    expect(checkRequest(req({ "content-type": "application/json", origin: "https://evil.example" }))).toMatchObject({ ok: false, status: 403 });
  });
});
