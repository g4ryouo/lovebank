-- T8:贈送愛心的限制(單次上限、每人每 7 天一次、不可用信用額度、兩筆加總為 0)。
begin;
select * from no_plan();

create function pg_temp.a() returns uuid language sql as $$ select 'a1000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.b() returns uuid language sql as $$ select 'a2000000-0000-0000-0000-000000000002'::uuid $$;
create function pg_temp.cA() returns uuid language sql as $$ select 'ca000000-0000-0000-0000-00000000000a'::uuid $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email) values (pg_temp.a(), 'a@t'), (pg_temp.b(), 'b@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values (pg_temp.cA(), 'CA', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname) values (pg_temp.a(), pg_temp.cA(), 'A'), (pg_temp.b(), pg_temp.cA(), 'B');
insert into public.ledger (couple_id, user_id, delta, reason, group_id) values
  (pg_temp.cA(), pg_temp.a(), 10000, 'initial', gen_random_uuid()),
  (pg_temp.cA(), pg_temp.b(), 500, 'initial', gen_random_uuid());

-- ---------- 單次上限 ----------
select pg_temp.as_user(pg_temp.a());
select throws_ok($$select public.send_gift(2001)$$, 'P0001', 'GIFT_LIMIT', '超過單次上限 2000 → GIFT_LIMIT');
select throws_ok($$select public.send_gift(0)$$, 'P0001', 'INVALID_AMOUNT', '金額 0 → INVALID_AMOUNT');
select throws_ok($$select public.send_gift(-1)$$, 'P0001', 'INVALID_AMOUNT', '負數 → INVALID_AMOUNT');
reset role;
select is((select count(*)::int from public.ledger where reason = 'gift'), 0, '被擋下的贈送不寫任何分錄');

select pg_temp.as_user(pg_temp.a());
select lives_ok($$select public.send_gift(2000, '佛心')$$, '剛好 2000 可以');
reset role;
select is((select count(*)::int from public.ledger where reason = 'gift'), 2, '寫了 2 筆分錄');
select is((select sum(delta)::int from public.ledger where reason = 'gift'), 0, '兩筆加總為 0');
select is(public._balance(pg_temp.a()), 8000, '贈送者 −2000');
select is(public._balance(pg_temp.b()), 2500, '收禮者 +2000');
select is((select note from public.ledger where reason = 'gift' and user_id = pg_temp.b()), '佛心', '備註保留');

-- ---------- 每人每 7 天一次 ----------
select pg_temp.as_user(pg_temp.a());
select throws_ok($$select public.send_gift(1)$$, 'P0001', 'GIFT_LIMIT', '7 天內再送 → GIFT_LIMIT');
select pg_temp.as_user(pg_temp.b());
select lives_ok($$select public.send_gift(100)$$, '對方(另一個人)還沒送過,可以送');
reset role;
select is((select count(*)::int from public.ledger where reason = 'gift'), 4, '各送一次,共 4 筆');

-- 冷卻期的邊界:用歷史分錄(ledger 禁止修改,所以直接插入帶時間的資料)
-- 另一對:A2/B2
insert into auth.users (id, email) values ('a3000000-0000-0000-0000-000000000003', 'c@t'), ('a4000000-0000-0000-0000-000000000004', 'd@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values ('cc000000-0000-0000-0000-00000000000c', 'CC', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname) values
  ('a3000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-00000000000c', 'C'),
  ('a4000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-00000000000c', 'D');
insert into public.ledger (couple_id, user_id, delta, reason, group_id) values
  ('cc000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000003', 5000, 'initial', gen_random_uuid()),
  ('cc000000-0000-0000-0000-00000000000c', 'a4000000-0000-0000-0000-000000000004', 5000, 'initial', gen_random_uuid());
-- C 在 6 天 23 小時前送過 → 仍在冷卻;D 在 7 天 1 分鐘前送過 → 已過冷卻
insert into public.ledger (couple_id, user_id, delta, reason, group_id, created_at) values
  ('cc000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000003', -100, 'gift', 'c1000000-0000-0000-0000-000000000001', now() - interval '6 days 23 hours'),
  ('cc000000-0000-0000-0000-00000000000c', 'a4000000-0000-0000-0000-000000000004', 100, 'gift', 'c1000000-0000-0000-0000-000000000001', now() - interval '6 days 23 hours'),
  ('cc000000-0000-0000-0000-00000000000c', 'a4000000-0000-0000-0000-000000000004', -100, 'gift', 'c2000000-0000-0000-0000-000000000002', now() - interval '7 days 1 minute'),
  ('cc000000-0000-0000-0000-00000000000c', 'a3000000-0000-0000-0000-000000000003', 100, 'gift', 'c2000000-0000-0000-0000-000000000002', now() - interval '7 days 1 minute');
select pg_temp.as_user('a3000000-0000-0000-0000-000000000003');
select throws_ok($$select public.send_gift(50)$$, 'P0001', 'GIFT_LIMIT', '6 天 23 小時前送過 → 還在冷卻');
select pg_temp.as_user('a4000000-0000-0000-0000-000000000004');
select lives_ok($$select public.send_gift(50)$$, '超過 7 天前送過 → 可以再送(收到禮物不算送出)');
reset role;

-- ---------- 不可用信用額度、不可動用預留 ----------
insert into auth.users (id, email) values ('a5000000-0000-0000-0000-000000000005', 'e@t'), ('a6000000-0000-0000-0000-000000000006', 'f@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values ('cd000000-0000-0000-0000-00000000000d', 'CD', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname, credit_limit) values
  ('a5000000-0000-0000-0000-000000000005', 'cd000000-0000-0000-0000-00000000000d', 'E', 100000),
  ('a6000000-0000-0000-0000-000000000006', 'cd000000-0000-0000-0000-00000000000d', 'F', 0);
insert into public.ledger (couple_id, user_id, delta, reason, group_id) values
  ('cd000000-0000-0000-0000-00000000000d', 'a5000000-0000-0000-0000-000000000005', 300, 'initial', gen_random_uuid());
select pg_temp.as_user('a5000000-0000-0000-0000-000000000005');
select throws_ok($$select public.send_gift(301)$$, 'P0001', 'INSUFFICIENT_BALANCE', '有信用額度也只能送自己有的愛心');
select lives_ok($$select public.send_gift(300)$$, '剛好等於餘額可以');
reset role;
select is(public._balance('a5000000-0000-0000-0000-000000000005'), 0, '送完餘額為 0(不是負數)');

-- ---------- 全域 ----------
select is((select count(*)::int from (select group_id from public.ledger where reason = 'gift' group by group_id having sum(delta) <> 0) x), 0, '所有 gift group 加總為 0');
select throws_ok($$update public.ledger set note = 'x' where reason = 'gift'$$, 'P0001', 'LEDGER_IMMUTABLE', '贈送紀錄不可修改');

select * from finish();
rollback;
