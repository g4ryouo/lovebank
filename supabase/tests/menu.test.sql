-- T5:菜單 RLS(直接寫入)與可見性。
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

insert into auth.users (id, email) values (pg_temp.a(), 'a@t'), (pg_temp.b(), 'b@t'), (pg_temp.x(), 'x@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values
  (pg_temp.cA(), 'CA', now() + interval '7 days', now()),
  ('cb000000-0000-0000-0000-00000000000b', 'CB', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname) values
  (pg_temp.a(), pg_temp.cA(), 'A'), (pg_temp.b(), pg_temp.cA(), 'B'),
  (pg_temp.x(), 'cb000000-0000-0000-0000-00000000000b', 'X');

-- ---------- A 的菜單:新增、價格 0 與上限、emoji ----------
select pg_temp.as_user(pg_temp.a());
select lives_ok($$insert into public.menu_items (couple_id, owner_id, title, emoji, price) values (pg_temp.cA(), pg_temp.a(), '親親', '💋', 100)$$, '新增項目');
select lives_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.a(), '免費抱抱', 0)$$, '價格 0 可以(沒有 emoji)');
select lives_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.a(), '最貴的', 100000)$$, '價格 100000 可以');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.a(), 'x', 100001)$$, '23514', null, '價格超過 100000 被擋');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.a(), 'x', -1)$$, '23514', null, '負價格被擋');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.a(), '', 1)$$, '23514', null, '空標題被擋');
select lives_ok($$update public.menu_items set price = 150, title = '親親(改)' where title = '親親'$$, '可改自己的價格與名稱');
select lives_ok($$update public.menu_items set emoji = '😘' where title = '親親(改)'$$, '可改 emoji');

-- ---------- 對方看不到停用的項目 ----------
select pg_temp.as_user(pg_temp.b());
select is((select count(*)::int from public.menu_items), 3, 'B 看得到 A 的 3 個啟用項目');
select pg_temp.as_user(pg_temp.a());
select lives_ok($$update public.menu_items set active = false where title = '最貴的'$$, 'A 停用一個項目');
select is((select count(*)::int from public.menu_items), 3, 'A 自己仍看得到全部 3 個(含停用)');
select pg_temp.as_user(pg_temp.b());
select is((select count(*)::int from public.menu_items), 2, 'B 看不到 A 停用的項目');
select is((select count(*)::int from public.menu_items where title = '最貴的'), 0, '直接用名稱查也看不到');
select pg_temp.as_user(pg_temp.a());
select lives_ok($$update public.menu_items set active = true where title = '最貴的'$$, 'A 重新啟用');
select pg_temp.as_user(pg_temp.b());
select is((select count(*)::int from public.menu_items), 3, '重新啟用後 B 又看得到');

-- ---------- 對方不能改我的菜單 ----------
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.a(), '偷加', 1)$$, '42501', null, 'B 不能替 A 新增項目');
select lives_ok($$update public.menu_items set price = 1 where owner_id = pg_temp.a()$$, 'B 改 A 的價格不報錯但不生效');
select throws_ok($$delete from public.menu_items where owner_id = pg_temp.a()$$, '42501', null, '沒有 DELETE 權限');
reset role;
select is((select count(*)::int from public.menu_items where owner_id = pg_temp.a() and price = 1), 0, 'A 的價格沒被 B 改動');
select is((select price from public.menu_items where title = '親親(改)'), 150, '價格仍是 150');

-- ---------- 別的情侶完全看不到 ----------
select pg_temp.as_user(pg_temp.x());
select is((select count(*)::int from public.menu_items), 0, '別的情侶看不到任何項目');
select throws_ok($$insert into public.menu_items (couple_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.x(), '外人', 1)$$, '42501', null, '外人不能新增到別人的情侶');
reset role;

-- ---------- 停用後,訂單仍可用快照顯示;建立訂單被擋 ----------
select pg_temp.as_user(pg_temp.b());
select lives_ok($$select public.create_order((select id from public.menu_items where title = '免費抱抱'))$$, 'B 可點啟用中的項目(免費)');
reset role;
update public.menu_items set active = false where title = '免費抱抱';
select pg_temp.as_user(pg_temp.b());
select is((select count(*)::int from public.menu_items where title = '免費抱抱'), 0, '停用後 B 看不到該項目');
select is((select title_snapshot from public.orders where title_snapshot = '免費抱抱'), '免費抱抱', '但已建立的訂單仍可讀(快照)');
reset role;
select is((select count(*)::int from pg_policies where tablename = 'menu_items' and cmd = 'DELETE'), 0, '沒有任何 DELETE policy');

select * from finish();
rollback;
