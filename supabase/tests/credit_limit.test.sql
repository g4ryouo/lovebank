-- T10:信用額度申請、核准或婉拒、對方直接設定。
begin;
select * from no_plan();

create function pg_temp.a() returns uuid language sql as $$ select 'a1000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.b() returns uuid language sql as $$ select 'a2000000-0000-0000-0000-000000000002'::uuid $$;
create function pg_temp.x() returns uuid language sql as $$ select 'b1000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.cA() returns uuid language sql as $$ select 'ca000000-0000-0000-0000-00000000000a'::uuid $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create temp table t (k text primary key, v text);
grant all on t to public;
create function pg_temp.v(k text) returns text language sql as $$ select v from pg_temp.t where t.k = $1 $$;

insert into auth.users (id, email) values (pg_temp.a(), 'a@t'), (pg_temp.b(), 'b@t'), (pg_temp.x(), 'x@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values
  (pg_temp.cA(), 'CA', now() + interval '7 days', now()),
  ('cb000000-0000-0000-0000-00000000000b', 'CB', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname) values
  (pg_temp.a(), pg_temp.cA(), 'A'), (pg_temp.b(), pg_temp.cA(), 'B'),
  (pg_temp.x(), 'cb000000-0000-0000-0000-00000000000b', 'X');
insert into public.ledger (couple_id, user_id, delta, reason, group_id) values
  (pg_temp.cA(), pg_temp.a(), 100, 'initial', gen_random_uuid());

-- ---------- 使用者不能直接改自己的額度(RLS 與欄位授權,T2 已涵蓋,這裡再確認函式不會被拿來改自己) ----------
select pg_temp.as_user(pg_temp.a());
select throws_ok($$update public.profiles set credit_limit = 2000 where id = pg_temp.a()$$, '42501', null, '直接 UPDATE 自己的 credit_limit 被擋');
select lives_ok($$select public.set_credit_limit(500)$$, 'A 呼叫 set_credit_limit(500)');
reset role;
select is((select credit_limit from public.profiles where id = pg_temp.a()), 0, 'A 自己的額度沒變(函式只設定對方)');
select is((select credit_limit from public.profiles where id = pg_temp.b()), 500, 'B 的額度變成 500(由 A 設定)');
select is((select credit_limit from public.profiles where id = pg_temp.x()), 0, '別的情侶不受影響');

-- ---------- 對方直接設定:上限與格式 ----------
select pg_temp.as_user(pg_temp.a());
select lives_ok($$select public.set_credit_limit(2000)$$, '剛好上限 2000 可以');
select throws_ok($$select public.set_credit_limit(2001)$$, 'P0001', 'LIMIT_TOO_HIGH', '超過上限 → LIMIT_TOO_HIGH');
select throws_ok($$select public.set_credit_limit(-1)$$, 'P0001', 'INVALID_AMOUNT', '負數 → INVALID_AMOUNT');
select throws_ok($$select public.set_credit_limit(null)$$, 'P0001', 'INVALID_AMOUNT', 'null → INVALID_AMOUNT');
select lives_ok($$select public.set_credit_limit(0)$$, '可以設回 0');
reset role;
select is((select credit_limit from public.profiles where id = pg_temp.b()), 0, 'B 的額度回到 0');

-- 額度立即反映在可用額度:B 餘額 0、額度 0 → 可用 0;A 調到 800 → 可用 800
select is(public._available(pg_temp.b()), 0, '調整前 B 可用 = 0');
select pg_temp.as_user(pg_temp.a());
select lives_ok($$select public.set_credit_limit(800)$$, 'A 把 B 的額度調到 800');
reset role;
select is(public._available(pg_temp.b()), 800, '可用額度立即反映 = 800');

-- 外人與未配對
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.set_credit_limit(100)$$, 'P0001', 'NOT_PAIRED', '沒有伴侶的人(獨自一對)→ NOT_PAIRED');
reset role;

-- ---------- 申請 ----------
select pg_temp.as_user(pg_temp.b());
select throws_ok($$select public.request_limit(2001)$$, 'P0001', 'LIMIT_TOO_HIGH', '申請超過上限 → LIMIT_TOO_HIGH');
select throws_ok($$select public.request_limit(-5)$$, 'P0001', 'INVALID_AMOUNT', '申請負數 → INVALID_AMOUNT');
select throws_ok($$select public.request_limit(800)$$, 'P0001', 'INVALID_AMOUNT', '申請和目前一樣 → INVALID_AMOUNT');
select throws_ok($$select public.request_limit(1000, repeat('x', 101))$$, 'P0001', 'INVALID_AMOUNT', '理由太長 → INVALID_AMOUNT');
select lives_ok($$insert into pg_temp.t select 'r1', (public.request_limit(1500, '  想存一點  ')).id::text$$, 'B 申請 1500');
select throws_ok($$select public.request_limit(1200)$$, 'P0001', 'ALREADY_PENDING', '已有待處理申請,不能再申請');
reset role;
select is((select reason from public.limit_requests where id = pg_temp.v('r1')::uuid), '想存一點', '理由去除前後空白');
select is((select status::text from public.limit_requests where id = pg_temp.v('r1')::uuid), 'pending', '狀態為 pending');
select is((select credit_limit from public.profiles where id = pg_temp.b()), 800, '申請時額度不變');

-- ---------- 核准 / 婉拒的權限 ----------
select pg_temp.as_user(pg_temp.b());
select throws_ok($$select public.decide_limit_request(pg_temp.v('r1')::uuid, true)$$, 'P0001', 'NOT_ALLOWED', '自己不能核准自己的申請');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.decide_limit_request(pg_temp.v('r1')::uuid, true)$$, 'P0001', 'NOT_ALLOWED', '別的情侶不能核准');
select throws_ok($$select public.decide_limit_request(gen_random_uuid(), true)$$, 'P0001', 'NOT_ALLOWED', '不存在的申請 → NOT_ALLOWED');
select pg_temp.as_user(pg_temp.a());
select is((select status::text from public.limit_requests), 'pending', 'A 看得到 B 的申請(同情侶可讀)');
select is((select (public.decide_limit_request(pg_temp.v('r1')::uuid, false)).status::text), 'declined', 'A 婉拒');
select is((select (public.decide_limit_request(pg_temp.v('r1')::uuid, false)).status::text), 'declined', '重複婉拒 → 無操作成功');
select throws_ok($$select public.decide_limit_request(pg_temp.v('r1')::uuid, true)$$, 'P0001', 'INVALID_STATE', '已婉拒不能再核准');
reset role;
select is((select credit_limit from public.profiles where id = pg_temp.b()), 800, '婉拒不改額度');
select isnt((select decided_at from public.limit_requests where id = pg_temp.v('r1')::uuid), null, '有決定時間');
select is((select decided_by from public.limit_requests where id = pg_temp.v('r1')::uuid), pg_temp.a(), '決定者是 A');

-- 婉拒後可以再申請一筆
select pg_temp.as_user(pg_temp.b());
select lives_ok($$insert into pg_temp.t select 'r2', (public.request_limit(1500)).id::text$$, '婉拒後可以重新申請');
select pg_temp.as_user(pg_temp.a());
select is((select (public.decide_limit_request(pg_temp.v('r2')::uuid, true)).status::text), 'approved', 'A 核准');
select is((select (public.decide_limit_request(pg_temp.v('r2')::uuid, true)).status::text), 'approved', '重複核准 → 無操作成功');
reset role;
select is((select credit_limit from public.profiles where id = pg_temp.b()), 1500, '核准後額度 = 1500');
select is(public._available(pg_temp.b()), 1500, '可用額度立即反映');
select is((select credit_limit from public.profiles where id = pg_temp.a()), 0, '核准者自己的額度不受影響');

-- 核准後可再申請(上一筆已結束)
select pg_temp.as_user(pg_temp.b());
select lives_ok($$select public.request_limit(0)$$, '核准後可再申請(調低)');
select pg_temp.as_user(pg_temp.a());
reset role;

-- 調低額度不追溯既有的預留(available 即時計算;不會動到 ledger / orders)
select is((select count(*)::int from public.ledger where reason <> 'initial'), 0, '額度操作不會寫任何 ledger');
select is((select count(*)::int from public.orders), 0, '額度操作不會動到訂單');

-- ---------- 函式安全 ----------
set local role anon;
select throws_ok($$select public.set_credit_limit(1)$$, '42501', null, 'anon 不能呼叫 set_credit_limit');
select throws_ok($$select public.request_limit(1)$$, '42501', null, 'anon 不能呼叫 request_limit');
select throws_ok($$select public.decide_limit_request(gen_random_uuid(), true)$$, '42501', null, 'anon 不能呼叫 decide_limit_request');
reset role;
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('set_credit_limit', 'request_limit', 'decide_limit_request')
  and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))), 0, '額度函式皆為 SECURITY DEFINER 且 search_path = ""');
select pg_temp.as_user(pg_temp.a());
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit) values (pg_temp.cA(), pg_temp.a(), 1)$$, '42501', null, '使用者不能直接寫 limit_requests');

select * from finish();
rollback;
