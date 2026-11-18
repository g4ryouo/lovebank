-- LINE 大頭貼:只能由已驗證憑證同步,只接受 LINE 官方圖片網址。
begin;
select * from no_plan();

create function pg_temp.a() returns uuid language sql as $$ select 'a1000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.b() returns uuid language sql as $$ select 'a2000000-0000-0000-0000-000000000002'::uuid $$;
create function pg_temp.x() returns uuid language sql as $$ select 'b1000000-0000-0000-0000-000000000001'::uuid $$;
create function pg_temp.cA() returns uuid language sql as $$ select 'ca000000-0000-0000-0000-00000000000a'::uuid $$;
-- 模擬登入:sub + user_metadata
create function pg_temp.as_user(uid uuid, meta jsonb default '{}') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'user_metadata', meta)::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email) values (pg_temp.a(), 'a@t'), (pg_temp.b(), 'b@t'), (pg_temp.x(), 'x@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values
  (pg_temp.cA(), 'CA', now() + interval '7 days', now()),
  ('cb000000-0000-0000-0000-00000000000b', 'CB', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname) values
  (pg_temp.a(), pg_temp.cA(), 'A'), (pg_temp.b(), pg_temp.cA(), 'B'),
  (pg_temp.x(), 'cb000000-0000-0000-0000-00000000000b', 'X');

-- ---------- 同步 ----------
select pg_temp.as_user(pg_temp.a(), '{"picture":"https://profile.line-scdn.net/0abc123_DEF-xyz/p"}');
select is(public.sync_my_avatar(), 'https://profile.line-scdn.net/0abc123_DEF-xyz/p', '同步 LINE 大頭貼(picture)');
select pg_temp.as_user(pg_temp.b(), '{"avatar_url":"https://profile.line-scdn.net/0bbb/p"}');
select is(public.sync_my_avatar(), 'https://profile.line-scdn.net/0bbb/p', '也接受 avatar_url 欄位');
select is(public.sync_my_avatar(), 'https://profile.line-scdn.net/0bbb/p', '重複同步 → 不變');
reset role;
select is((select avatar_url from public.profiles where id = pg_temp.a()), 'https://profile.line-scdn.net/0abc123_DEF-xyz/p', '已寫入 profile');

-- ---------- 對方看得到 ----------
select pg_temp.as_user(pg_temp.b());
select is((select avatar_url from public.profiles where id = pg_temp.a()), 'https://profile.line-scdn.net/0abc123_DEF-xyz/p', '同一對的人看得到彼此的大頭貼');
select pg_temp.as_user(pg_temp.x());
select is((select count(*)::int from public.profiles where avatar_url is not null), 0, '別的情侶看不到');

-- ---------- 不合規的網址一律不收 ----------
select pg_temp.as_user(pg_temp.x(), '{"picture":"https://evil.example/tracker.png"}');
select is(public.sync_my_avatar(), null, '外部網址不收');
select pg_temp.as_user(pg_temp.x(), '{"picture":"http://profile.line-scdn.net/abc"}');
select is(public.sync_my_avatar(), null, 'http(非 https)不收');
select pg_temp.as_user(pg_temp.x(), '{"picture":"https://profile.line-scdn.net.evil.example/abc"}');
select is(public.sync_my_avatar(), null, '網域偽裝(後面接別的網域)不收');
select pg_temp.as_user(pg_temp.x(), '{"picture":"https://evil.example/https://profile.line-scdn.net/abc"}');
select is(public.sync_my_avatar(), null, '把官方網址藏在後面不收');
select pg_temp.as_user(pg_temp.x(), '{"picture":"https://profile.line-scdn.net/abc?x=<script>"}');
select is(public.sync_my_avatar(), null, '帶有查詢字串或特殊字元不收');
select pg_temp.as_user(pg_temp.x(), '{"picture":"https://profile.line-scdn.net/abc\u0007"}');
select is(public.sync_my_avatar(), null, '控制字元不收');
select pg_temp.as_user(pg_temp.x(), '{"picture":"javascript:alert(1)"}');
select is(public.sync_my_avatar(), null, 'javascript: 不收');
select pg_temp.as_user(pg_temp.x(), '{}');
select is(public.sync_my_avatar(), null, '憑證沒有大頭貼 → 維持空');
select pg_temp.as_user(pg_temp.x(), '{"picture":""}');
select is(public.sync_my_avatar(), null, '空字串 → 維持空');
reset role;
select is((select avatar_url from public.profiles where id = pg_temp.x()), null, '不合規的都沒寫進資料庫');

-- 已有大頭貼,之後憑證換成不合規的 → 保留舊的(不被覆蓋成壞值)
select pg_temp.as_user(pg_temp.a(), '{"picture":"https://evil.example/x.png"}');
select is(public.sync_my_avatar(), 'https://profile.line-scdn.net/0abc123_DEF-xyz/p', '憑證變成不合規 → 保留原本的');
-- 大頭貼更新:憑證換成新的合法網址
select pg_temp.as_user(pg_temp.a(), '{"picture":"https://profile.line-scdn.net/0new/p"}');
select is(public.sync_my_avatar(), 'https://profile.line-scdn.net/0new/p', '換了新大頭貼會更新');

-- ---------- 使用者不能自己亂填 ----------
select throws_ok($$update public.profiles set avatar_url = 'https://profile.line-scdn.net/self/p' where id = pg_temp.a()$$, '42501', null, '使用者不能直接改 avatar_url');
select throws_ok($$update public.profiles set avatar_url = 'https://evil.example/t.png' where id = pg_temp.a()$$, '42501', null, '也不能填外部網址');
reset role;
select throws_ok($$update public.profiles set avatar_url = 'https://evil.example/t.png' where id = pg_temp.a()$$, '23514', null, '連資料庫管理者直接寫入,約束也擋外部網址');

-- ---------- 沒登入、未配對 ----------
set local role anon;
select throws_ok($$select public.sync_my_avatar()$$, '42501', null, 'anon 不能呼叫');
reset role;
insert into auth.users (id, email) values ('ff000000-0000-0000-0000-0000000000ff', 'n@t');
select pg_temp.as_user('ff000000-0000-0000-0000-0000000000ff', '{"picture":"https://profile.line-scdn.net/a/p"}');
select throws_ok($$select public.sync_my_avatar()$$, 'P0001', 'NOT_PAIRED', '沒有 profile → NOT_PAIRED');
reset role;
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'sync_my_avatar' and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))), 0, '函式為 SECURITY DEFINER 且 search_path = ""');

select * from finish();
rollback;
