-- T2 驗收:RLS、欄位授權、ledger 不可變、各項約束。
begin;
select * from no_plan();

-- ---------- 測試資料(以 postgres 身分建立) ----------
-- 情侶 A:a1(提供者)、a2(接受者);情侶 B:b1、b2
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'a1@test'),
  ('a2000000-0000-0000-0000-000000000002', 'a2@test'),
  ('b1000000-0000-0000-0000-000000000001', 'b1@test'),
  ('b2000000-0000-0000-0000-000000000002', 'b2@test');

insert into public.couples (id, invite_code, invite_expires_at, paired_at) values
  ('ca000000-0000-0000-0000-00000000000a', 'CODE-A', now() + interval '7 days', now()),
  ('cb000000-0000-0000-0000-00000000000b', 'CODE-B', now() + interval '7 days', now());

insert into public.profiles (id, couple_id, nickname) values
  ('a1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-00000000000a', 'A1'),
  ('a2000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-00000000000a', 'A2'),
  ('b1000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-00000000000b', 'B1'),
  ('b2000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-00000000000b', 'B2');

insert into public.menu_items (id, couple_id, owner_id, title, price) values
  ('e1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'a1 hug', 100),
  ('e2000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000002', 'a2 massage', 200),
  ('eb000000-0000-0000-0000-00000000000b', 'cb000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'b1 item', 50);

-- A 組:一筆已完成(100)、一筆進行中 accepted(300,預留)
insert into public.orders (id, couple_id, menu_item_id, giver_id, receiver_id, initiated_by,
  price_snapshot, title_snapshot, status, settled_amount) values
  ('d1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002',
   100, 'a1 hug', 'completed', 100);
insert into public.orders (id, couple_id, menu_item_id, giver_id, receiver_id, initiated_by,
  price_snapshot, title_snapshot, status) values
  ('d2000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   300, 'a1 hug', 'accepted'),
  ('db000000-0000-0000-0000-00000000000b', 'cb000000-0000-0000-0000-00000000000b', 'eb000000-0000-0000-0000-00000000000b',
   'b1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002',
   50, 'b1 item', 'requested');

insert into public.ledger (couple_id, user_id, delta, reason, group_id, order_id) values
  ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 100, 'order', 'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000002', -100, 'order', 'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001');
insert into public.ledger (couple_id, user_id, delta, reason, group_id) values
  ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 2000, 'initial', gen_random_uuid()),
  ('ca000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000002', 2000, 'initial', gen_random_uuid()),
  ('cb000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 2000, 'initial', gen_random_uuid());

insert into public.limit_requests (couple_id, requester_id, requested_limit) values
  ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 500),
  ('cb000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 500);
insert into public.service_proposals (couple_id, proposer_id, owner_id, title, price) values
  ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'trip', 900),
  ('cb000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'trip b', 900);

-- 切換身分的輔助函式
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  execute 'set local role service_role';
end $$;

-- ---------- 0. 結構檢查 ----------
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, '所有資料表都啟用 RLS');

-- ---------- 1. 使用者 A1 看不到別的情侶 ----------
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.couples), 1, 'A1 只看到自己的情侶');
select is((select count(*)::int from public.profiles where couple_id <> 'ca000000-0000-0000-0000-00000000000a'), 0, 'A1 看不到 B 組 profile');
select is((select count(*)::int from public.profiles), 2, 'A1 看得到同情侶 2 位成員');
select is((select count(*)::int from public.menu_items where couple_id = 'cb000000-0000-0000-0000-00000000000b'), 0, 'A1 看不到 B 組菜單');
select is((select count(*)::int from public.menu_items), 2, 'A1 看得到同情侶菜單');
select is((select count(*)::int from public.orders where couple_id = 'cb000000-0000-0000-0000-00000000000b'), 0, 'A1 看不到 B 組訂單');
select is((select count(*)::int from public.orders), 2, 'A1 看得到同情侶訂單');
select is((select count(*)::int from public.limit_requests where couple_id = 'cb000000-0000-0000-0000-00000000000b'), 0, 'A1 看不到 B 組額度申請');
select is((select count(*)::int from public.service_proposals where couple_id = 'cb000000-0000-0000-0000-00000000000b'), 0, 'A1 看不到 B 組提案');
select is((select count(*)::int from public.service_proposals), 1, 'A1 看得到同情侶提案');

-- ---------- 2. ledger 只能讀到自己的列 ----------
select is((select count(*)::int from public.ledger where user_id <> 'a1000000-0000-0000-0000-000000000001'), 0, 'A1 讀不到任何別人的 ledger');
select is((select count(*)::int from public.ledger), 2, 'A1 讀得到自己的 2 筆 ledger');
select is((select balance from public.balances), 2100, 'balances view 只回本人,A1 = 2100');
select is((select count(*)::int from public.balances), 1, 'balances 只有一列');
select is((select reserved from public.reserved), 0, 'A1 reserved = 0(預留的是接受者)');

select pg_temp.as_user('a2000000-0000-0000-0000-000000000002');
select is((select balance from public.balances), 1900, 'A2 balance = 1900');
select is((select reserved from public.reserved), 300, 'A2 reserved = 300');

-- ---------- 3. credit_limit 與 profiles ----------
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select throws_ok($$update public.profiles set credit_limit = 99999 where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null, '使用者不能 UPDATE 自己的 credit_limit');
select throws_ok($$update public.profiles set couple_id = 'cb000000-0000-0000-0000-00000000000b' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null, '使用者不能改自己的 couple_id');
select lives_ok($$update public.profiles set nickname = 'new' where id = 'a1000000-0000-0000-0000-000000000001'$$, '可更新自己的 nickname');
select lives_ok($$update public.profiles set nickname = 'hacked' where id = 'a2000000-0000-0000-0000-000000000002'$$, '改對方 nickname 不報錯但不生效');
select throws_ok($$insert into public.profiles (id, couple_id, nickname) values (gen_random_uuid(), null, 'x')$$,
  '42501', null, '使用者不能直接 INSERT profiles');
select throws_ok($$delete from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null, '使用者不能 DELETE profiles');
select throws_ok($$update public.couples set daily_allowance = 99999$$, '42501', null, '使用者不能改 couples');

-- ---------- 4. orders 不可直接寫 ----------
select throws_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 1, 'x')$$,
  '42501', null, '使用者不能直接 INSERT orders');
select throws_ok($$update public.orders set status = 'completed', settled_amount = 300 where id = 'd2000000-0000-0000-0000-000000000002'$$,
  '42501', null, '使用者不能直接 UPDATE orders');
select throws_ok($$delete from public.orders where id = 'd2000000-0000-0000-0000-000000000002'$$,
  '42501', null, '使用者不能 DELETE orders');

-- ---------- 5. ledger 不可直接寫、不可變 ----------
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id)
  values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 999999, 'adjustment', gen_random_uuid())$$,
  '42501', null, '使用者不能直接 INSERT ledger');
select throws_ok($$update public.ledger set delta = 1$$, '42501', null, '使用者不能 UPDATE ledger');
select throws_ok($$delete from public.ledger$$, '42501', null, '使用者不能 DELETE ledger');

select pg_temp.as_service();
select throws_ok($$update public.ledger set delta = 1$$, '42501', null, 'service_role 不能 UPDATE ledger');
select throws_ok($$delete from public.ledger$$, '42501', null, 'service_role 不能 DELETE ledger');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id)
  values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 5, 'initial', gen_random_uuid())$$,
  '42501', null, 'service_role 不能直接 INSERT ledger');
select throws_ok($$update public.orders set status = 'cancelled'$$, '42501', null, 'service_role 不能直接 UPDATE orders');

reset role;
select throws_ok($$update public.ledger set delta = 1$$, 'P0001', 'LEDGER_IMMUTABLE', '連 owner 也不能 UPDATE ledger(trigger)');
select throws_ok($$delete from public.ledger$$, 'P0001', 'LEDGER_IMMUTABLE', '連 owner 也不能 DELETE ledger(trigger)');
select throws_ok($$truncate public.ledger$$, 'P0001', 'LEDGER_IMMUTABLE', '連 owner 也不能 TRUNCATE ledger(trigger)');

-- ---------- 6. menu_items:只能改自己的 ----------
select pg_temp.as_user('a1000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.menu_items (couple_id, owner_id, title, price)
  values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'new item', 0)$$, '可新增自己的項目(價格 0)');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price)
  values ('ca000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000002', 'sneaky', 10)$$,
  '42501', null, '不能在對方菜單新增項目');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price)
  values ('cb000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-000000000001', 'other couple', 10)$$,
  '42501', null, '不能新增到別的情侶');
select lives_ok($$update public.menu_items set price = 150 where id = 'e1000000-0000-0000-0000-000000000001'$$, '可改自己項目價格');
select lives_ok($$update public.menu_items set price = 1 where id = 'e2000000-0000-0000-0000-000000000002'$$, '改對方項目不報錯但不生效');
select throws_ok($$update public.menu_items set owner_id = 'a2000000-0000-0000-0000-000000000002' where id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501', null, '不能改項目的 owner_id');
select throws_ok($$delete from public.menu_items where id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501', null, '不提供 DELETE menu_items');
select lives_ok($$update public.menu_items set active = false where id = 'e1000000-0000-0000-0000-000000000001'$$, '可停用自己的項目(軟刪除)');

-- ---------- 7. anon 什麼都碰不到 ----------
select pg_temp.as_anon();
select throws_ok($$select * from public.ledger$$, '42501', null, 'anon 不能讀 ledger');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon 不能讀 profiles');
select throws_ok($$select * from public.balances$$, '42501', null, 'anon 不能讀 balances');

-- ---------- 8. 副作用確認(回到 postgres 檢查) ----------
reset role;
select is((select nickname from public.profiles where id = 'a2000000-0000-0000-0000-000000000002'), 'A2', '對方 nickname 未被改動');
select is((select price from public.menu_items where id = 'e2000000-0000-0000-0000-000000000002'), 200, '對方菜單價格未被改動');
select is((select price from public.menu_items where id = 'e1000000-0000-0000-0000-000000000001'), 150, '自己菜單價格已改');
select is((select credit_limit from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'), 0, 'credit_limit 仍為 0');
select cmp_ok((select updated_at from public.menu_items where id = 'e1000000-0000-0000-0000-000000000001'),
  '>', (select created_at from public.menu_items where id = 'e1000000-0000-0000-0000-000000000001'), 'updated_at trigger 生效');

-- ---------- 9. check / unique / FK 約束 ----------
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 't', -1)$$, '23514', null, '價格不可為負');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 't', 100001)$$, '23514', null, '價格不可超過 100000');
select lives_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 't', 100000)$$, '價格 100000 可');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', '', 1)$$, '23514', null, '標題不可為空');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', repeat('x', 41), 1)$$, '23514', null, '標題最多 40 字');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values ('cb000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-000000000001', 't', 1)$$, '23503', null, '項目的 owner 與 couple 不一致(複合 FK)');

select throws_ok($$update public.profiles set nickname = '' where id = 'a1000000-0000-0000-0000-000000000001'$$, '23514', null, '暱稱不可為空');
select throws_ok($$update public.profiles set nickname = repeat('x', 21) where id = 'a1000000-0000-0000-0000-000000000001'$$, '23514', null, '暱稱最多 20 字');
select throws_ok($$update public.profiles set credit_limit = -1 where id = 'a1000000-0000-0000-0000-000000000001'$$, '23514', null, 'credit_limit 不可為負');
select throws_ok($$insert into public.couples (invite_code, invite_expires_at) values ('CODE-A', now())$$, '23505', null, '邀請碼不可重複');
select throws_ok($$insert into public.couples (invite_code, invite_expires_at, daily_allowance) values ('X1', now(), -1)$$, '23514', null, 'daily_allowance 不可為負');

select throws_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'x')$$,
  '23514', null, 'giver 與 receiver 不可相同');
select throws_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 1, 'x')$$,
  '23514', null, 'initiated_by 必須是 giver 或 receiver');
select throws_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', -1, 'x')$$,
  '23514', null, 'price_snapshot 不可為負');
select lives_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 0, 'free')$$,
  '價格 0 的訂單可建立');
select throws_ok($$update public.orders set status = 'completed' where id = 'd2000000-0000-0000-0000-000000000002'$$, '23514', null, 'completed 必須有 settled_amount');
select throws_ok($$update public.orders set settled_amount = 1 where id = 'd2000000-0000-0000-0000-000000000002'$$, '23514', null, '非 completed 不可有 settled_amount');
select throws_ok($$update public.orders set status = 'completed', settled_amount = 301 where id = 'd2000000-0000-0000-0000-000000000002'$$, '23514', null, 'settled_amount 不可超過價格');
select throws_ok($$update public.orders set status = 'completed', settled_amount = -1 where id = 'd2000000-0000-0000-0000-000000000002'$$, '23514', null, 'settled_amount 不可為負');
select lives_ok($$update public.orders set status = 'completed', settled_amount = 0 where id = 'd2000000-0000-0000-0000-000000000002'$$, '免費完成(settled_amount = 0)可');
select throws_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'x')$$,
  '23503', null, 'giver 必須是項目擁有者(複合 FK)');
select throws_ok($$insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by, price_snapshot, title_snapshot)
  values ('ca000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'x')$$,
  '23503', null, 'receiver 必須屬於同一情侶(複合 FK)');

select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 0, 'adjustment', gen_random_uuid())$$, '23514', null, 'ledger delta 不可為 0');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 5, 'order', gen_random_uuid())$$, '23514', null, 'reason = order 必須有 order_id');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id, order_id) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 5, 'order', 'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001')$$, '23505', null, '同一訂單同一人只能有一筆 order ledger');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 5, 'initial', gen_random_uuid())$$, '23505', null, '每人只能有一筆 initial');
select lives_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id, period_key) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 500, 'allowance', gen_random_uuid(), '2026-01-02')$$, '第一次發放某日 allowance 可');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id, period_key) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 500, 'allowance', gen_random_uuid(), '2026-01-02')$$, '23505', null, '同一天不可重複發 allowance');
select lives_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id, period_key) values ('ca000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000002', 500, 'allowance', gen_random_uuid(), '2026-01-02')$$, '另一人同一天可發');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 500, 'allowance', gen_random_uuid())$$, '23514', null, 'allowance 必須有 period_key');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id, period_key) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 500, 'allowance', gen_random_uuid(), '2026/01/03')$$, '23514', null, 'period_key 格式須為 YYYY-MM-DD');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', -5, 'adjustment', gen_random_uuid())$$, '23514', null, 'adjustment 必須有 note');
select lives_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id, note) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', -5, 'adjustment', gen_random_uuid(), 'fix')$$, 'adjustment 有 note 可');
select throws_ok($$insert into public.ledger (couple_id, user_id, delta, reason, group_id) values ('cb000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-000000000001', 5, 'gift', gen_random_uuid())$$, '23503', null, 'ledger 的 user 與 couple 必須一致');

select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 100)$$, '23505', null, '每人同時只能有一筆待處理額度申請');
select lives_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit) values ('ca000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000002', 100)$$, '另一人可有自己的待處理申請');
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status, decided_by) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 100, 'approved', 'a1000000-0000-0000-0000-000000000001')$$, '23514', null, '不能自己核准自己的申請');
select throws_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', -1)$$, '23514', null, '申請額度不可為負');
select lives_ok($$insert into public.limit_requests (couple_id, requester_id, requested_limit, status, decided_by, decided_at) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 100, 'approved', 'a2000000-0000-0000-0000-000000000002', now())$$, '由另一位成員核准可(舊申請已非 pending)');

select throws_ok($$insert into public.service_proposals (couple_id, proposer_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 't', 1)$$, '23514', null, '提案人不可等於項目擁有者');
select throws_ok($$insert into public.service_proposals (couple_id, proposer_id, owner_id, title, price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 't', 100001)$$, '23514', null, '提案價格不可超過上限');
select throws_ok($$insert into public.service_proposals (couple_id, proposer_id, owner_id, title, price, counter_price) values ('ca000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 't', 1, -1)$$, '23514', null, '還價不可為負');

select * from finish();
rollback;
