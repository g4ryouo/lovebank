/**
 * 測試用的假 Supabase:不連網路,依「資料表 → 列」的假資料回答查詢。
 * 只實作頁面用到的查詢方法(select / eq / neq / in / lt / order / limit / maybeSingle)。
 * 巢狀查詢(例如 orders(title_snapshot))直接把巢狀物件放在假資料的列裡。
 */
export type Row = Record<string, unknown>;
export type FakeDb = Record<string, Row[]>;

class Query implements PromiseLike<{ data: Row[]; error: null; count: number }> {
  private rows: Row[];
  constructor(rows: Row[]) {
    this.rows = [...rows];
  }
  select() {
    return this;
  }
  eq(k: string, v: unknown) {
    this.rows = this.rows.filter((r) => r[k] === v);
    return this;
  }
  neq(k: string, v: unknown) {
    this.rows = this.rows.filter((r) => r[k] !== v);
    return this;
  }
  in(k: string, vs: unknown[]) {
    this.rows = this.rows.filter((r) => vs.includes(r[k]));
    return this;
  }
  lt(k: string, v: number) {
    this.rows = this.rows.filter((r) => Number(r[k]) < v);
    return this;
  }
  order(k: string, o?: { ascending?: boolean }) {
    const dir = o?.ascending === false ? -1 : 1;
    this.rows.sort((a, b) => (String(a[k]) < String(b[k]) ? -dir : String(a[k]) > String(b[k]) ? dir : 0));
    return this;
  }
  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  then<T, U>(ok?: (v: { data: Row[]; error: null; count: number }) => T | PromiseLike<T>, bad?: (e: unknown) => U | PromiseLike<U>) {
    return Promise.resolve({ data: this.rows, error: null, count: this.rows.length }).then(ok, bad);
  }
}

export function fakeSupabase(db: FakeDb, rpc: Record<string, unknown> = {}) {
  return {
    from: (table: string) => new Query(db[table] ?? []),
    rpc: (name: string) => Promise.resolve({ data: rpc[name] ?? null, error: null }),
    auth: { getClaims: () => Promise.resolve({ data: { claims: { sub: "me" } } }), getUser: () => Promise.resolve({ data: { user: { id: "me" } } }) },
  };
}
