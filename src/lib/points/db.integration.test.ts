/**
 * 對真實資料庫的「同時執行」測試。需要環境變數 LOVEBANK_TEST_DB_URL(超級使用者連線字串)
 * 與本機 psql;未設定時整檔略過,不影響 `pnpm test`。
 * 做法:用一個交易(pg_sleep)把鎖握住,另一個連線在同一時間呼叫,驗證互斥與冪等。
 *
 *   本機 Supabase:LOVEBANK_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:integration
 *   無 Docker 時:pnpm db:test:local(會自動設定)
 *
 * 注意:ledger 禁止刪除,測試資料不清理(使用隨機 id);要清掉請 `pnpm db:reset`。
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const URL = process.env.LOVEBANK_TEST_DB_URL;

interface PsqlResult {
  code: number | null;
  out: string;
  err: string;
  ms: number;
}

function psql(sql: string): Promise<PsqlResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", URL ?? "", "-f", "-"]);
    let out = "";
    let err = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString()));
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("close", (code) => resolve({ code, out, err, ms: Date.now() - started }));
    p.stdin.end(sql);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const asUser = (id: string) =>
  `select set_config('request.jwt.claims', '{"sub":"${id}"}', true); set local role authenticated;`;
/** 以某使用者身分執行 calls,之後睡 holdSec 秒再 commit(握住鎖) */
const session = (id: string, calls: string, holdSec = 0) =>
  `begin; ${asUser(id)} ${calls} ${holdSec ? `select pg_sleep(${holdSec});` : ""} commit;`;

async function scalar(sql: string): Promise<string> {
  const r = await psql(sql);
  if (r.code !== 0) throw new Error(r.err);
  return r.out.trim();
}

async function setup() {
  const c = randomUUID();
  const g = randomUUID();
  const r = randomUUID();
  const items = { hug: randomUUID(), hug2: randomUUID() };
  const sql = `
    insert into auth.users (id, email) values ('${g}', '${g}@it'), ('${r}', '${r}@it');
    insert into public.couples (id, invite_code, invite_expires_at, paired_at)
      values ('${c}', '${c}', now() + interval '7 days', now() - interval '10 days');
    insert into public.profiles (id, couple_id, nickname) values ('${g}', '${c}', 'G'), ('${r}', '${c}', 'R');
    insert into public.menu_items (id, couple_id, owner_id, title, price) values
      ('${items.hug}', '${c}', '${g}', 'hug', 600), ('${items.hug2}', '${c}', '${g}', 'hug2', 600);
    insert into public.ledger (couple_id, user_id, delta, reason, group_id)
      values ('${c}', '${r}', 1000, 'initial', gen_random_uuid());`;
  const res = await psql(sql);
  if (res.code !== 0) throw new Error(res.err);
  return { c, g, r, items };
}

/** 提供者主動邀請,回傳訂單 id */
async function invite(g: string, item: string) {
  const r = await psql(`begin; ${asUser(g)} select (public.create_order('${item}')).id; commit;`);
  if (r.code !== 0) throw new Error(r.err);
  return r.out.trim().split("\n").pop() ?? "";
}
const call = (user: string, fn: string, id: string, extra = "") =>
  psql(session(user, `select (public.${fn}('${id}'${extra})).status;`));

describe.skipIf(!URL)("資料庫同時執行(整合測試)", { timeout: 60_000 }, () => {
  it("同一筆訂單同時兩次 confirm_order:ledger 只有 2 筆,兩次都成功", async () => {
    const { g, r, items } = await setup();
    const o = await invite(g, items.hug);
    expect((await call(r, "respond_order", o, ", true")).code).toBe(0);
    expect((await call(g, "mark_done", o)).code).toBe(0);

    const a = psql(session(r, `select (public.confirm_order('${o}')).status;`, 1.5));
    await sleep(500);
    const b = await call(r, "confirm_order", o);
    const aRes = await a;

    expect(aRes.code).toBe(0);
    expect(b.code).toBe(0);
    expect(b.out).toContain("completed");
    expect(b.ms).toBeGreaterThan(700); // 第二個確實等了第一個(鎖生效)
    expect(await scalar(`select count(*) from public.ledger where order_id = '${o}'`)).toBe("2");
    expect(await scalar(`select sum(delta) from public.ledger where order_id = '${o}'`)).toBe("0");
  });

  it("兩筆訂單合計超過可用額度、同時被接受:恰好一筆成功、一筆 INSUFFICIENT_CREDIT", async () => {
    const { g, r, items } = await setup(); // r 餘額 1000,兩筆各 600
    const o1 = await invite(g, items.hug);
    const o2 = await invite(g, items.hug2);

    const a = psql(session(r, `select (public.respond_order('${o1}', true)).status;`, 1.2));
    await sleep(400);
    const b = await call(r, "respond_order", o2, ", true");
    const aRes = await a;

    const results = [aRes, b];
    expect(results.filter((x) => x.code === 0)).toHaveLength(1);
    const failed = results.find((x) => x.code !== 0);
    expect(failed?.err).toContain("INSUFFICIENT_CREDIT");
    expect(
      await scalar(`select count(*) from public.orders where receiver_id = '${r}' and status = 'accepted'`),
    ).toBe("1");
  });

  it("同時兩次 touch_couple:零用點數只發一次", async () => {
    const { r, g, c } = await setup();
    const [x, y] = await Promise.all([
      psql(session(r, `select public.touch_couple();`, 0.5)),
      psql(session(g, `select public.touch_couple();`)),
    ]);
    expect(x.code).toBe(0);
    expect(y.code).toBe(0);
    const total = (await scalar(`select count(*) from public.ledger where couple_id = '${c}' and reason = 'allowance'`));
    expect(total).toBe("14"); // 雙方各 7 天,沒有重複
    const again = await psql(session(r, `select public.touch_couple();`));
    expect(again.out).toContain('"allowance": 0');
  });

  it("自動確認與手動確認同時發生:ledger 只有 2 筆", async () => {
    const { g, r, items, c } = await setup();
    const o = await invite(g, items.hug);
    await call(r, "respond_order", o, ", true");
    await call(g, "mark_done", o);
    expect(await scalar(`update public.orders set auto_confirm_at = now() - interval '1 hour' where id = '${o}' returning 1`)).toBe("1");

    const a = psql(session(r, `select (public.confirm_order('${o}')).status;`, 1.2));
    await sleep(400);
    const b = await psql(session(g, `select public.touch_couple();`));
    await a;
    expect(b.code).toBe(0);
    expect(await scalar(`select count(*) from public.ledger where order_id = '${o}'`)).toBe("2");
    expect(await scalar(`select status from public.orders where id = '${o}'`)).toBe("completed");
    expect(await scalar(`select count(*) from public.ledger where couple_id = '${c}' and reason = 'order'`)).toBe("2");
  });

  it("同時贈送與接受訂單:不會讓可用額度被重複使用", async () => {
    const { g, r, items } = await setup(); // r 餘額 1000
    const o = await invite(g, items.hug); // 600
    const a = psql(session(r, `select public.send_gift(500);`, 1.2)); // 先握住鎖,贈送 500
    await sleep(400);
    const b = await call(r, "respond_order", o, ", true"); // 接受 600:1000 − 500 = 500 < 600
    const aRes = await a;
    expect(aRes.code).toBe(0);
    expect(b.code).not.toBe(0);
    expect(b.err).toContain("INSUFFICIENT_CREDIT");
  });

  it("兩個人同時用同一個邀請碼加入:恰好一人成功,另一人 COUPLE_FULL", async () => {
    const creator = randomUUID();
    const a = randomUUID();
    const b = randomUUID();
    const ins = await psql(
      `insert into auth.users (id, email) values ('${creator}', '${creator}@it'), ('${a}', '${a}@it'), ('${b}', '${b}@it');`,
    );
    if (ins.code !== 0) throw new Error(ins.err);
    const created = await psql(session(creator, `select (public.create_couple('甲')).invite_code;`));
    expect(created.code).toBe(0);
    const code = created.out.trim().split("\n").pop() ?? "";

    const x = psql(session(a, `select (public.join_couple('${code}', 'A')).id;`, 1.2));
    await sleep(400);
    const y = await psql(session(b, `select (public.join_couple('${code}', 'B')).id;`));
    const xRes = await x;

    const results = [xRes, y];
    expect(results.filter((r) => r.code === 0)).toHaveLength(1);
    expect(results.find((r) => r.code !== 0)?.err).toContain("COUPLE_FULL");
    expect(await scalar(`select count(*) from public.profiles where id in ('${creator}', '${a}', '${b}')`)).toBe("2");
    expect(await scalar(`select count(*) from public.ledger where user_id in ('${creator}', '${a}', '${b}') and reason = 'initial'`)).toBe("2");
  });

  it("兩人各自建立後,同時輸入對方的邀請碼:不會死結,最後只成立一對", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const ins = await psql(`insert into auth.users (id, email) values ('${a}', '${a}@it'), ('${b}', '${b}@it');`);
    if (ins.code !== 0) throw new Error(ins.err);
    const ca = await psql(session(a, `select (public.create_couple('A')).invite_code;`));
    const cb = await psql(session(b, `select (public.create_couple('B')).invite_code;`));
    const codeA = ca.out.trim().split("\n").pop() ?? "";
    const codeB = cb.out.trim().split("\n").pop() ?? "";

    const [x, y] = await Promise.all([
      psql(session(a, `select (public.join_couple('${codeB}', 'A')).id;`, 0.8)),
      psql(session(b, `select (public.join_couple('${codeA}', 'B')).id;`, 0.8)),
    ]);

    for (const r of [x, y]) expect(r.err).not.toContain("deadlock");
    expect([x, y].filter((r) => r.code === 0).length).toBeGreaterThanOrEqual(1);
    // 不論誰先搶到,最後兩人必須在同一對、且只有一對、各 1 筆 initial
    expect(await scalar(`select count(distinct couple_id) from public.profiles where id in ('${a}', '${b}')`)).toBe("1");
    expect(await scalar(`select count(*) from public.profiles where id in ('${a}', '${b}')`)).toBe("2");
    expect(await scalar(`select count(*) from public.ledger where user_id in ('${a}', '${b}') and reason = 'initial'`)).toBe("2");
    expect(await scalar(`select count(*) from public.couples where invite_code in ('${codeA}', '${codeB}')`)).toBe("1");
  });

  it("同一個人同時送兩次禮:只成立一次,另一次 GIFT_LIMIT", async () => {
    const { g, r } = await setup(); // r 餘額 1000
    const a = psql(session(r, `select public.send_gift(100);`, 1.2));
    await sleep(400);
    const b = await psql(session(r, `select public.send_gift(100);`));
    const aRes = await a;
    const results = [aRes, b];
    expect(results.filter((x) => x.code === 0)).toHaveLength(1);
    expect(results.find((x) => x.code !== 0)?.err).toContain("GIFT_LIMIT");
    expect(await scalar(`select count(*) from public.ledger where reason = 'gift' and user_id in ('${g}', '${r}')`)).toBe("2");
    expect(await scalar(`select sum(delta) from public.ledger where reason = 'gift' and user_id in ('${g}', '${r}')`)).toBe("0");
  });

  it("同一個人同時送出兩個額度申請:只成立一筆,另一筆 ALREADY_PENDING", async () => {
    const { r } = await setup();
    const a = psql(session(r, `select (public.request_limit(500)).id;`, 1.2));
    await sleep(400);
    const b = await psql(session(r, `select (public.request_limit(800)).id;`));
    const aRes = await a;
    const results = [aRes, b];
    expect(results.filter((x) => x.code === 0)).toHaveLength(1);
    expect(results.find((x) => x.code !== 0)?.err).toContain("ALREADY_PENDING");
    expect(await scalar(`select count(*) from public.limit_requests where requester_id = '${r}' and status = 'pending'`)).toBe("1");
  });

  it("申請人撤回與對方同意同時發生:只會有一種結果,額度與狀態一致", async () => {
    const { g, r } = await setup();
    const req = await psql(session(r, `select (public.request_limit(700)).id;`));
    expect(req.code).toBe(0);
    const id = req.out.trim().split("\n").pop() ?? "";

    const w = psql(session(r, `select (public.withdraw_limit_request('${id}')).status;`, 1.2));
    await sleep(400);
    const d = await psql(session(g, `select (public.decide_limit_request('${id}', true)).status;`));
    const wRes = await w;

    expect(wRes.code).toBe(0); // 先拿到鎖的是撤回
    expect(d.code).not.toBe(0); // 對方的同意晚一步:申請已撤回
    expect(d.err).toContain("INVALID_STATE");
    expect(await scalar(`select status from public.limit_requests where id = '${id}'`)).toBe("withdrawn");
    expect(await scalar(`select credit_limit from public.profiles where id = '${r}'`)).toBe("0");
  });

  /** 以超級使用者(模擬伺服器端的 service_role)建立一筆提案,回傳提案 id */
  async function makeProposal(proposer: string, title: string, price: number) {
    const r = await psql(`select (public.internal_create_proposal('${proposer}', '${title}', null, ${price}, 'ok', 'ok')).id;`);
    if (r.code !== 0) throw new Error(r.err);
    return r.out.trim().split("\n").pop() ?? "";
  }

  it("提案同時被同意與婉拒:只有一種結果,菜單最多建立一個項目", async () => {
    const { g, r, c } = await setup();
    const id = await makeProposal(g, "同時測試", 300); // g 提案,擁有者是 r
    const a = psql(session(r, `select (public.respond_proposal('${id}', 'agree')).status;`, 1.2));
    await sleep(400);
    const b = await psql(session(r, `select (public.respond_proposal('${id}', 'reject')).status;`));
    await a;
    expect(b.code).not.toBe(0);
    expect(b.err).toContain("INVALID_STATE");
    expect(await scalar(`select status from public.service_proposals where id = '${id}'`)).toBe("agreed");
    expect(await scalar(`select count(*) from public.menu_items where couple_id = '${c}' and title = '同時測試'`)).toBe("1");
  });

  it("提案同時同意兩次:兩次都成功,菜單只有一個項目", async () => {
    const { g, r, c } = await setup();
    const id = await makeProposal(g, "重複同意", 100);
    const a = psql(session(r, `select (public.respond_proposal('${id}', 'agree')).status;`, 1.0));
    await sleep(300);
    const b = await psql(session(r, `select (public.respond_proposal('${id}', 'agree')).status;`));
    const aRes = await a;
    expect(aRes.code).toBe(0);
    expect(b.code).toBe(0);
    expect(await scalar(`select count(*) from public.menu_items where couple_id = '${c}' and title = '重複同意'`)).toBe("1");
  });

  it("還價與撤回同時發生:只有一種結果", async () => {
    const { g, r } = await setup();
    const id = await makeProposal(g, "還價對撤回", 500);
    const counter = psql(`select (public.internal_set_counter_review('${id}', '${r}', 200, 'ok', 'ok')).status;`);
    const withdraw = psql(session(g, `select (public.withdraw_proposal('${id}')).status;`));
    await Promise.all([counter, withdraw]);
    const status = await scalar(`select status from public.service_proposals where id = '${id}'`);
    expect(["countered", "withdrawn"]).toContain(status);
    // 若先還價、後撤回:撤回(提案人)也合法,最終 withdrawn;不可能出現其他狀態
  });

  it("25 個 AI 呼叫同時搶每日 20 次的額度:恰好 20 次成功、5 次 AI_LIMIT", async () => {
    const { g } = await setup();
    const results = await Promise.all(
      Array.from({ length: 25 }, () => psql(`select public.internal_reserve_ai_call('${g}', 'proposal_review');`)),
    );
    expect(results.filter((x) => x.code === 0)).toHaveLength(20);
    expect(results.filter((x) => x.code !== 0 && x.err.includes("AI_LIMIT"))).toHaveLength(5);
    expect(await scalar(`select count(*) from public.ai_usage where user_id = '${g}' and kind = 'proposal_review'`)).toBe("20");
  });
});
