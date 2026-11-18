-- T4(資料庫部分):create_couple、join_couple。(同時加入見 db.integration.test.ts)
begin;
select * from no_plan();

create function pg_temp.u(n int) returns uuid language sql as $$ select ('c' || n || '000000-0000-0000-0000-000000000000')::uuid $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create temp table t (k text primary key, v text);
grant all on t to public;
create function pg_temp.v(k text) returns text language sql as $$ select v from pg_temp.t where t.k = $1 $$;

insert into auth.users (id, email) select pg_temp.u(n), n || '@t' from generate_series(1, 8) n;

-- ---------- create_couple ----------
select pg_temp.as_user(pg_temp.u(1));
select lives_ok($$insert into pg_temp.t select 'code', (public.create_couple('小明')).invite_code$$, '建立情侶');
select throws_ok($$select public.create_couple('again')$$, 'P0001', 'INVALID_STATE', '已有情侶不能再建立');
select throws_ok($$select public.join_couple('X', 'again')$$, 'P0001', 'INVITE_INVALID', '(找不到的邀請碼)');
select pg_temp.as_user(pg_temp.u(2));
select throws_ok($$select public.create_couple('')$$, '23514', null, '暱稱不可為空');
select throws_ok($$select public.create_couple(repeat('x', 21))$$, '23514', null, '暱稱最多 20 字');
select throws_ok($$select public.create_couple('   ')$$, '23514', null, '只有空白的暱稱不可');
reset role;
set local request.jwt.claims = '';
set local role authenticated;
select throws_ok($$select public.create_couple('x')$$, 'P0001', 'NOT_ALLOWED', '沒有登入身分 → NOT_ALLOWED');
reset role;
set local role anon;
select throws_ok($$select public.create_couple('x')$$, '42501', null, 'anon 不能呼叫 create_couple');
select throws_ok($$select public.join_couple('x', 'x')$$, '42501', null, 'anon 不能呼叫 join_couple');
reset role;

select matches(pg_temp.v('code'), '^[A-HJ-NP-Z2-9]{8}$', '邀請碼 8 碼且避開易混淆字元');
select is((select nickname from public.profiles where id = pg_temp.u(1)), '小明', '建立者的 profile');
select is((select paired_at from public.couples where invite_code = pg_temp.v('code')), null, '尚未配對:paired_at 為空');
select is((select count(*)::int from public.ledger), 0, '尚未配對:沒有 initial');
select ok((select invite_expires_at - now() from public.couples where invite_code = pg_temp.v('code')) between interval '6 days 23 hours' and interval '7 days', '邀請碼 7 天有效');
select is((select credit_limit from public.profiles where id = pg_temp.u(1)), 0, '預設信用額度 0');

-- ---------- join_couple ----------
select pg_temp.as_user(pg_temp.u(2));
select throws_ok($$select public.join_couple('ZZZZZZZZ', '小美')$$, 'P0001', 'INVITE_INVALID', '錯誤邀請碼 → INVITE_INVALID');
select throws_ok($$select public.join_couple(null, '小美')$$, 'P0001', 'INVITE_INVALID', 'null 邀請碼 → INVITE_INVALID');
select throws_ok($$select public.join_couple('', '小美')$$, 'P0001', 'INVITE_INVALID', '空邀請碼 → INVITE_INVALID');
select lives_ok($$select public.join_couple('  ' || lower(pg_temp.v('code')) || ' ', '小美')$$, '邀請碼不分大小寫、忽略前後空白');
select lives_ok($$select public.join_couple(pg_temp.v('code'), '小美')$$, '重複加入同一情侶 → 無副作用的成功');
select pg_temp.as_user(pg_temp.u(1));
select lives_ok($$select public.join_couple(pg_temp.v('code'), '小明')$$, '建立者用自己的碼 → 無副作用的成功');
select pg_temp.as_user(pg_temp.u(3));
select throws_ok($$select public.join_couple(pg_temp.v('code'), '第三人')$$, 'P0001', 'COUPLE_FULL', '第三人加入失敗:COUPLE_FULL');
reset role;

select is((select count(*)::int from public.profiles where couple_id = (select id from public.couples where invite_code = pg_temp.v('code'))), 2, '成員恰好 2 人');
select isnt((select paired_at from public.couples where invite_code = pg_temp.v('code')), null, '配對後有 paired_at');
select is((select count(*)::int from public.ledger where reason = 'initial'), 2, 'initial 恰好 2 筆(重複呼叫不重複發)');
select is(public._balance(pg_temp.u(1)), 2000, '建立者有 2000 愛心');
select is(public._balance(pg_temp.u(2)), 2000, '加入者有 2000 愛心');
select is((select count(*)::int from public.profiles where id = pg_temp.u(3)), 0, '第三人沒有 profile');
select is((select count(*)::int from public.ledger where user_id = pg_temp.u(3)), 0, '第三人沒有分錄');

-- 配對後彼此可見,第三人看不到
select pg_temp.as_user(pg_temp.u(1));
select is((select count(*)::int from public.profiles), 2, '配對後看得到對方 profile');
select is((select balance from public.balances), 2000, 'balances 顯示 2000');
select pg_temp.as_user(pg_temp.u(2));
select is((select count(*)::int from public.profiles), 2, '另一方也看得到');
reset role;

-- ---------- 過期、已在別的情侶 ----------
select pg_temp.as_user(pg_temp.u(4));
select lives_ok($$insert into pg_temp.t select 'code2', (public.create_couple('四號')).invite_code$$, '另一對:建立');
reset role;
update public.couples set invite_expires_at = now() - interval '1 second' where invite_code = pg_temp.v('code2');
select pg_temp.as_user(pg_temp.u(5));
select throws_ok($$select public.join_couple(pg_temp.v('code2'), '五號')$$, 'P0001', 'INVITE_INVALID', '邀請碼過期 → INVITE_INVALID');
select is((select count(*)::int from public.profiles where id = pg_temp.u(5)), 0, '過期不建立 profile');
reset role;
update public.couples set invite_expires_at = now() + interval '1 day' where invite_code = pg_temp.v('code2');
select pg_temp.as_user(pg_temp.u(2));
select throws_ok($$select public.join_couple(pg_temp.v('code2'), '小美')$$, 'P0001', 'INVALID_STATE', '已在別的情侶 → INVALID_STATE');
select pg_temp.as_user(pg_temp.u(5));
select lives_ok($$select public.join_couple(pg_temp.v('code2'), '五號')$$, '未過期可加入');
select pg_temp.as_user(pg_temp.u(6));
select throws_ok($$select public.join_couple(pg_temp.v('code2'), '六號')$$, 'P0001', 'COUPLE_FULL', '滿員後再加入 → COUPLE_FULL');
reset role;
select is((select count(*)::int from public.ledger where reason = 'initial'), 4, '兩對共 4 筆 initial');

-- 自訂 initial_grant 與 0 的情況
update public.couples set initial_grant = 0 where invite_code = pg_temp.v('code2');
select is((select count(*)::int from (select group_id from public.ledger where reason = 'initial' group by group_id having count(*) > 1) x), 0, 'initial 每筆各自一個 group_id');

-- 加入後可以正常使用 touch_couple(隔天補發 500)
select is((public._touch_couple_at((select id from public.couples where invite_code = pg_temp.v('code')),
  (select paired_at + interval '1 day' from public.couples where invite_code = pg_temp.v('code')))->>'allowance')::int, 2, '配對隔天補發零用點數(雙方各一筆)');

-- ---------- 兩個人都按了「建立」:可放棄自己的空殼,改加入對方 ----------
select pg_temp.as_user(pg_temp.u(6));
select lives_ok($$insert into pg_temp.t select 'code6', (public.create_couple('六號')).invite_code$$, '六號自己建立了一對');
select pg_temp.as_user(pg_temp.u(3));
select lives_ok($$insert into pg_temp.t select 'code3', (public.create_couple('三號')).invite_code$$, '三號也建立了一對');
select lives_ok($$insert into public.menu_items (couple_id, owner_id, title, price) select couple_id, id, '配對前的菜單', 1 from public.profiles where id = pg_temp.u(3)$$, '三號配對前先新增了菜單項目');
select throws_ok($$select public.create_couple('again')$$, 'P0001', 'INVALID_STATE', '已有一對不能再建立');
select throws_ok($$select public.join_couple('ZZZZZZZZ', '三號')$$, 'P0001', 'INVITE_INVALID', '輸錯邀請碼不會讓自己的一對消失');
reset role;
select is((select count(*)::int from public.profiles where id = pg_temp.u(3)), 1, '輸錯邀請碼後,三號仍在自己的一對');
select pg_temp.as_user(pg_temp.u(3));
select lives_ok($$select public.join_couple(pg_temp.v('code6'), '三號')$$, '三號放棄自己的空殼,改加入六號');
reset role;
select is((select count(*)::int from public.couples where invite_code = pg_temp.v('code3')), 0, '三號原本的一對已刪除');
select is((select count(*)::int from public.menu_items where owner_id = pg_temp.u(3)), 0, '三號配對前的菜單一併清掉');
select is((select couple_id from public.profiles where id = pg_temp.u(3)), (select id from public.couples where invite_code = pg_temp.v('code6')), '三號現在在六號的一對');
select isnt((select paired_at from public.couples where invite_code = pg_temp.v('code6')), null, '配對完成');
select is(public._balance(pg_temp.u(3)), 2000, '三號有 2000 愛心');
select is(public._balance(pg_temp.u(6)), 2000, '六號有 2000 愛心');
select is((select count(*)::int from public.ledger where user_id in (pg_temp.u(3), pg_temp.u(6)) and reason = 'initial'), 2, '各一筆 initial,沒有重複');

-- 已配對的人不能離開去加別的
select pg_temp.as_user(pg_temp.u(4));
select throws_ok($$select public.join_couple(pg_temp.v('code'), '四號')$$, 'P0001', 'INVALID_STATE', '已配對的人不能再加入別的一對');
reset role;
select is((select count(*)::int from public.profiles where id = pg_temp.u(4)), 1, '四號仍在自己的一對');

-- 加入別人已滿的一對失敗:整個交易回復,仍保有自己的空殼
select pg_temp.as_user(pg_temp.u(7));
select lives_ok($$insert into pg_temp.t select 'code7', (public.create_couple('七號')).invite_code$$, '七號建立一對');
select throws_ok($$select public.join_couple(pg_temp.v('code'), '七號')$$, 'P0001', 'COUPLE_FULL', '對方那一對已滿 → COUPLE_FULL');
reset role;
select is((select count(*)::int from public.profiles where id = pg_temp.u(7)), 1, '加入失敗後,七號仍在自己的一對(整個交易回復)');
select is((select count(*)::int from public.couples where invite_code = pg_temp.v('code7')), 1, '七號的一對沒被刪掉');

-- 單人一對之間互相加入(兩個空殼各自建立後,其中一人改加入對方)
select pg_temp.as_user(pg_temp.u(8));
select lives_ok($$insert into pg_temp.t select 'code8', (public.create_couple('八號')).invite_code$$, '八號建立一對');
select lives_ok($$select public.join_couple(pg_temp.v('code7'), '八號')$$, '八號放棄自己的空殼,加入七號');
reset role;
select is((select count(*)::int from public.profiles where couple_id = (select id from public.couples where invite_code = pg_temp.v('code7'))), 2, '七號的一對有 2 人');
select is((select count(*)::int from public.couples where invite_code = pg_temp.v('code8')), 0, '八號原本的一對已刪除');
select pg_temp.as_user(pg_temp.u(7));
select throws_ok($$select public.join_couple(pg_temp.v('code8'), '七號')$$, 'P0001', 'INVITE_INVALID', '八號放棄的邀請碼失效 → INVITE_INVALID');
reset role;

-- 函式安全性
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('create_couple', 'join_couple')
  and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))), 0, '配對函式皆為 SECURITY DEFINER 且 search_path = ""');
select pg_temp.as_user(pg_temp.u(1));
select throws_ok($$select public._new_invite_code()$$, '42501', null, '使用者不能直接呼叫 _new_invite_code');

select * from finish();
rollback;
