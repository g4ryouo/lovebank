-- 撤回額度申請。
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

-- B 申請,可以撤回
select pg_temp.as_user(pg_temp.b());
select lives_ok($$insert into pg_temp.t select 'r1', (public.request_limit(500, '想存一點')).id::text$$, 'B 提出申請');
select throws_ok($$select public.request_limit(800)$$, 'P0001', 'ALREADY_PENDING', '待處理時不能再申請');
select pg_temp.as_user(pg_temp.a());
select throws_ok($$select public.withdraw_limit_request(pg_temp.v('r1')::uuid)$$, 'P0001', 'NOT_ALLOWED', '對方不能替我撤回(他用婉拒)');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.withdraw_limit_request(pg_temp.v('r1')::uuid)$$, 'P0001', 'NOT_ALLOWED', '外人不能撤回');
select throws_ok($$select public.withdraw_limit_request(gen_random_uuid())$$, 'P0001', 'NOT_ALLOWED', '不存在的申請 → NOT_ALLOWED');
select pg_temp.as_user(pg_temp.b());
select is((select (public.withdraw_limit_request(pg_temp.v('r1')::uuid)).status::text), 'withdrawn', '申請人撤回');
select is((select (public.withdraw_limit_request(pg_temp.v('r1')::uuid)).status::text), 'withdrawn', '重複撤回 → 無操作成功');
reset role;
select is((select decided_by from public.limit_requests where id = pg_temp.v('r1')::uuid), null, '撤回沒有決定者');
select is((select credit_limit from public.profiles where id = pg_temp.b()), 0, '撤回不改額度');

-- 撤回後:對方不能再核准或婉拒;申請人可以重新申請
select pg_temp.as_user(pg_temp.a());
select throws_ok($$select public.decide_limit_request(pg_temp.v('r1')::uuid, true)$$, 'P0001', 'INVALID_STATE', '已撤回的申請不能核准');
select throws_ok($$select public.decide_limit_request(pg_temp.v('r1')::uuid, false)$$, 'P0001', 'INVALID_STATE', '已撤回的申請不能婉拒');
select pg_temp.as_user(pg_temp.b());
select lives_ok($$insert into pg_temp.t select 'r2', (public.request_limit(800)).id::text$$, '撤回後可以重新申請');
select pg_temp.as_user(pg_temp.a());
select is((select (public.decide_limit_request(pg_temp.v('r2')::uuid, true)).status::text), 'approved', '新的申請被核准');
select pg_temp.as_user(pg_temp.b());
select throws_ok($$select public.withdraw_limit_request(pg_temp.v('r2')::uuid)$$, 'P0001', 'INVALID_STATE', '已核准的申請不能撤回');
reset role;
select is((select credit_limit from public.profiles where id = pg_temp.b()), 800, '額度 = 800');

-- 婉拒過的也不能撤回
select pg_temp.as_user(pg_temp.b());
select lives_ok($$insert into pg_temp.t select 'r3', (public.request_limit(100)).id::text$$, 'B 再申請');
select pg_temp.as_user(pg_temp.a());
select lives_ok($$select public.decide_limit_request(pg_temp.v('r3')::uuid, false)$$, 'A 婉拒');
select pg_temp.as_user(pg_temp.b());
select throws_ok($$select public.withdraw_limit_request(pg_temp.v('r3')::uuid)$$, 'P0001', 'INVALID_STATE', '已婉拒的申請不能撤回');
reset role;

-- 資料表約束仍然嚴格
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status) values (pg_temp.cA(), pg_temp.a(), 1, 'approved')$$, '23514', null, '已核准一定要有決定者');
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status, decided_by) values (pg_temp.cA(), pg_temp.a(), 1, 'pending', pg_temp.b())$$, '23514', null, '待處理不能有決定者');
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status, decided_by) values (pg_temp.cA(), pg_temp.a(), 1, 'withdrawn', pg_temp.b())$$, '23514', null, '已撤回不能有決定者');
select lives_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status) values (pg_temp.cA(), pg_temp.a(), 1, 'withdrawn')$$, '已撤回、沒有決定者可以');
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status, decided_by) values (pg_temp.cA(), pg_temp.a(), 1, 'approved', pg_temp.a())$$, '23514', null, '不能自己核准自己');
-- 撤回的申請不占用「每人一筆待處理」
select lives_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit) values (pg_temp.cA(), pg_temp.a(), 5)$$, '多筆已撤回不影響唯一的待處理申請');
select lives_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status) values (pg_temp.cA(), pg_temp.a(), 6, 'withdrawn')$$, '同一人可有多筆已撤回');

-- 函式安全
set local role anon;
select throws_ok($$select public.withdraw_limit_request(gen_random_uuid())$$, '42501', null, 'anon 不能呼叫 withdraw_limit_request');
reset role;
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'withdraw_limit_request'
  and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))), 0, '撤回函式為 SECURITY DEFINER 且 search_path = ""');

select * from finish();
rollback;
