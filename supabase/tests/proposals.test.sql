-- T11:服務提案(同意/婉拒/還價一次/撤回)與 AI 使用次數上限。
begin;
select * from no_plan();

create function pg_temp.p() returns uuid language sql as $$ select 'a1000000-0000-0000-0000-000000000001'::uuid $$;  -- 提案人
create function pg_temp.o() returns uuid language sql as $$ select 'a2000000-0000-0000-0000-000000000002'::uuid $$;  -- 菜單擁有者(提案對象)
create function pg_temp.x() returns uuid language sql as $$ select 'b1000000-0000-0000-0000-000000000001'::uuid $$;  -- 別的情侶
create function pg_temp.cA() returns uuid language sql as $$ select 'ca000000-0000-0000-0000-00000000000a'::uuid $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create temp table t (k text primary key, v text);
grant all on t to public;
create function pg_temp.v(k text) returns uuid language sql as $$ select v::uuid from pg_temp.t where t.k = $1 $$;

insert into auth.users (id, email) values (pg_temp.p(), 'p@t'), (pg_temp.o(), 'o@t'), (pg_temp.x(), 'x@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values
  (pg_temp.cA(), 'CA', now() + interval '7 days', now()),
  ('cb000000-0000-0000-0000-00000000000b', 'CB', now() + interval '7 days', now());
insert into public.profiles (id, couple_id, nickname) values
  (pg_temp.p(), pg_temp.cA(), 'P'), (pg_temp.o(), pg_temp.cA(), 'O'),
  (pg_temp.x(), 'cb000000-0000-0000-0000-00000000000b', 'X');

-- ---------- 權限:internal_* 只有 service_role ----------
select pg_temp.as_user(pg_temp.p());
select throws_ok($$select public.internal_create_proposal(pg_temp.p(), 't', null, 1, 'ok', 'c')$$, '42501', null, '使用者不能呼叫 internal_create_proposal');
select throws_ok($$select public.internal_set_counter_review(gen_random_uuid(), pg_temp.p(), 1, 'ok', 'c')$$, '42501', null, '使用者不能呼叫 internal_set_counter_review');
select throws_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'support')$$, '42501', null, '使用者不能呼叫 internal_reserve_ai_call');
reset role;
set local role anon;
select throws_ok($$select public.respond_proposal(gen_random_uuid(), 'agree')$$, '42501', null, 'anon 不能呼叫 respond_proposal');
reset role;

-- ---------- 建立提案(伺服器以 service_role 呼叫) ----------
set local role service_role;
select lives_ok($$insert into pg_temp.t select 'a', (public.internal_create_proposal(pg_temp.p(), '  帶我去日本玩  ', '  ✈️ ', 5000, 'caution', '價格有點高')).id::text$$, '建立提案(AI 有提醒)');
select lives_ok($$insert into pg_temp.t select 'b', (public.internal_create_proposal(pg_temp.p(), '洗碗', '', 50, 'unavailable', null)).id::text$$, '建立提案(AI 無法審查)');
select lives_ok($$insert into pg_temp.t select 'c', (public.internal_create_proposal(pg_temp.p(), '倒垃圾', null, 30, 'ok', repeat('字', 700))).id::text$$, '建立提案(過長的意見會被截斷)');
select throws_ok($$select public.internal_create_proposal(pg_temp.p(), 'x', null, 100001, 'ok', 'c')$$, '23514', null, '價格超過上限被擋');
select throws_ok($$select public.internal_create_proposal(pg_temp.p(), '', null, 1, 'ok', 'c')$$, '23514', null, '空名稱被擋');
select throws_ok($$select public.internal_create_proposal(gen_random_uuid(), 'x', null, 1, 'ok', 'c')$$, 'P0001', 'NOT_PAIRED', '不屬於任何情侶 → NOT_PAIRED');
reset role;
select is((select owner_id from public.service_proposals where id = pg_temp.v('a')), pg_temp.o(), '項目將加入「對方」的菜單');
select is((select title from public.service_proposals where id = pg_temp.v('a')), '帶我去日本玩', '名稱去除前後空白');
select is((select emoji from public.service_proposals where id = pg_temp.v('a')), '✈️', '圖示去除空白');
select is((select emoji from public.service_proposals where id = pg_temp.v('b')), null, '空圖示變 null');
select is((select status::text from public.service_proposals where id = pg_temp.v('a')), 'pending', '初始為 pending');
select isnt((select ai_reviewed_at from public.service_proposals where id = pg_temp.v('a')), null, 'AI 有審查 → 有審查時間');
select is((select ai_reviewed_at from public.service_proposals where id = pg_temp.v('b')), null, 'AI 無法審查 → 沒有審查時間');
select is((select ai_verdict::text from public.service_proposals where id = pg_temp.v('b')), 'unavailable', '狀態為 unavailable');
select is((select char_length(ai_comment) from public.service_proposals where id = pg_temp.v('c')), 500, '意見最多 500 字');
select is((select count(*)::int from public.menu_items), 0, '提案階段不會動到菜單');

-- ---------- 對方同意 / 婉拒 ----------
select pg_temp.as_user(pg_temp.p());
select throws_ok($$select public.respond_proposal(pg_temp.v('a'), 'agree')$$, 'P0001', 'NOT_ALLOWED', '提案人不能替對方同意');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.respond_proposal(pg_temp.v('a'), 'agree')$$, 'P0001', 'NOT_ALLOWED', '外人不能回應');
select is((select count(*)::int from public.service_proposals), 0, '外人看不到別人的提案');
select pg_temp.as_user(pg_temp.o());
select throws_ok($$select public.respond_proposal(pg_temp.v('a'), 'counter')$$, 'P0001', 'INVALID_STATE', '還價不走這裡(要先經伺服器審查)');
select throws_ok($$select public.respond_proposal(gen_random_uuid(), 'agree')$$, 'P0001', 'NOT_ALLOWED', '不存在的提案 → NOT_ALLOWED');
select is((select (public.respond_proposal(pg_temp.v('a'), 'agree')).status::text), 'agreed', '對方同意');
select is((select (public.respond_proposal(pg_temp.v('a'), 'agree')).status::text), 'agreed', '重複同意 → 無操作成功');
select throws_ok($$select public.respond_proposal(pg_temp.v('a'), 'reject')$$, 'P0001', 'INVALID_STATE', '已同意不能再婉拒');
select is((select (public.respond_proposal(pg_temp.v('b'), 'reject')).status::text), 'rejected', '對方婉拒');
select is((select (public.respond_proposal(pg_temp.v('b'), 'reject')).status::text), 'rejected', '重複婉拒 → 無操作成功');
select throws_ok($$select public.respond_proposal(pg_temp.v('b'), 'agree')$$, 'P0001', 'INVALID_STATE', '已婉拒不能再同意');
reset role;
select is((select count(*)::int from public.menu_items), 1, '同意後只建立一個菜單項目(重複同意不重複建立)');
select is((select owner_id from public.menu_items), pg_temp.o(), '項目在「擁有者」的菜單');
select is((select price from public.menu_items), 5000, '價格 = 提案價格');
select is((select title || coalesce(emoji, '') from public.menu_items), '帶我去日本玩✈️', '名稱與圖示');
select is((select active from public.menu_items), true, '項目為啟用中');
select is((select menu_item_id from public.service_proposals where id = pg_temp.v('a')), (select id from public.menu_items), '提案記錄對應的菜單項目');
select is((select menu_item_id from public.service_proposals where id = pg_temp.v('b')), null, '婉拒不建立菜單項目');
select pg_temp.as_user(pg_temp.p());
select is((select count(*)::int from public.menu_items), 1, '提案人看得到新項目(同情侶、啟用中)');
select throws_ok($$update public.service_proposals set status = 'agreed'$$, '42501', null, '使用者不能直接改提案');
select throws_ok($$insert into public.service_proposals (couple_id, proposer_id, owner_id, title, price) values (pg_temp.cA(), pg_temp.p(), pg_temp.o(), 'x', 1)$$, '42501', null, '使用者不能直接新增提案');
reset role;

-- ---------- 還價(只能一次) ----------
set local role service_role;
select lives_ok($$insert into pg_temp.t select 'd', (public.internal_create_proposal(pg_temp.p(), '按摩一小時', '💆', 2000, 'caution', '偏高')).id::text$$, '另一個提案');
select throws_ok($$select public.internal_set_counter_review(pg_temp.v('d'), pg_temp.p(), 800, 'ok', 'c')$$, 'P0001', 'NOT_ALLOWED', '提案人不能替對方還價');
select throws_ok($$select public.internal_set_counter_review(pg_temp.v('d'), pg_temp.x(), 800, 'ok', 'c')$$, 'P0001', 'NOT_ALLOWED', '外人不能還價');
select throws_ok($$select public.internal_set_counter_review(pg_temp.v('d'), pg_temp.o(), 2000, 'ok', 'c')$$, 'P0001', 'INVALID_AMOUNT', '還價和原價一樣 → INVALID_AMOUNT');
select throws_ok($$select public.internal_set_counter_review(pg_temp.v('d'), pg_temp.o(), -1, 'ok', 'c')$$, 'P0001', 'INVALID_AMOUNT', '還價為負 → INVALID_AMOUNT');
select throws_ok($$select public.internal_set_counter_review(pg_temp.v('d'), pg_temp.o(), 100001, 'ok', 'c')$$, 'P0001', 'INVALID_AMOUNT', '還價超過上限 → INVALID_AMOUNT');
select is((select (public.internal_set_counter_review(pg_temp.v('d'), pg_temp.o(), 800, 'ok', '合理')).status::text), 'countered', '擁有者還價 800');
select throws_ok($$select public.internal_set_counter_review(pg_temp.v('d'), pg_temp.o(), 500, 'ok', 'c')$$, 'P0001', 'INVALID_STATE', '第二次還價被拒');
reset role;
select is((select counter_price from public.service_proposals where id = pg_temp.v('d')), 800, '記錄還價');
select is((select counter_ai_verdict::text from public.service_proposals where id = pg_temp.v('d')), 'ok', '記錄價格審查結果');
select is((select price from public.service_proposals where id = pg_temp.v('d')), 2000, '原提案價格不變');
select pg_temp.as_user(pg_temp.o());
select throws_ok($$select public.respond_proposal(pg_temp.v('d'), 'agree')$$, 'P0001', 'INVALID_STATE', '已還價的提案,擁有者不能直接同意(等提案人回應)');
select throws_ok($$select public.decide_counter(pg_temp.v('d'), true)$$, 'P0001', 'NOT_ALLOWED', '擁有者不能替提案人接受還價');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.decide_counter(pg_temp.v('d'), true)$$, 'P0001', 'NOT_ALLOWED', '外人不能回應還價');
select pg_temp.as_user(pg_temp.p());
select throws_ok($$select public.decide_counter(pg_temp.v('b'), true)$$, 'P0001', 'INVALID_STATE', '非還價狀態不能接受還價');
select is((select (public.decide_counter(pg_temp.v('d'), true)).status::text), 'agreed', '提案人接受還價');
select is((select (public.decide_counter(pg_temp.v('d'), true)).status::text), 'agreed', '重複接受 → 無操作成功');
reset role;
select is((select price from public.menu_items where title = '按摩一小時'), 800, '成立後菜單價格 = 還價 800');
select is((select owner_id from public.menu_items where title = '按摩一小時'), pg_temp.o(), '項目在擁有者菜單');
select is((select count(*)::int from public.menu_items where title = '按摩一小時'), 1, '重複接受不重複建立');

-- 還價後婉拒
set local role service_role;
select lives_ok($$insert into pg_temp.t select 'e', (public.internal_create_proposal(pg_temp.p(), '早餐', null, 300, 'ok', 'ok')).id::text$$, '再一個提案');
select lives_ok($$select public.internal_set_counter_review(pg_temp.v('e'), pg_temp.o(), 100, 'ok', 'ok')$$, '還價');
reset role;
select pg_temp.as_user(pg_temp.p());
select is((select (public.decide_counter(pg_temp.v('e'), false)).status::text), 'rejected', '提案人婉拒還價');
select is((select (public.decide_counter(pg_temp.v('e'), false)).status::text), 'rejected', '重複婉拒 → 無操作成功');
select throws_ok($$select public.decide_counter(pg_temp.v('e'), true)$$, 'P0001', 'INVALID_STATE', '已婉拒不能再接受');
reset role;
select is((select count(*)::int from public.menu_items where title = '早餐'), 0, '婉拒還價不建立菜單項目');

-- ---------- 撤回 ----------
set local role service_role;
select lives_ok($$insert into pg_temp.t select 'f', (public.internal_create_proposal(pg_temp.p(), '捶背', null, 100, 'ok', 'ok')).id::text$$, '提案 f');
select lives_ok($$insert into pg_temp.t select 'g', (public.internal_create_proposal(pg_temp.p(), '洗車', null, 400, 'ok', 'ok')).id::text$$, '提案 g');
select lives_ok($$select public.internal_set_counter_review(pg_temp.v('g'), pg_temp.o(), 200, 'ok', 'ok')$$, 'g 被還價');
reset role;
select pg_temp.as_user(pg_temp.o());
select throws_ok($$select public.withdraw_proposal(pg_temp.v('f'))$$, 'P0001', 'NOT_ALLOWED', '擁有者不能替提案人撤回(他用婉拒)');
select pg_temp.as_user(pg_temp.p());
select is((select (public.withdraw_proposal(pg_temp.v('f'))).status::text), 'withdrawn', '提案人撤回待回應的提案');
select is((select (public.withdraw_proposal(pg_temp.v('f'))).status::text), 'withdrawn', '重複撤回 → 無操作成功');
select is((select (public.withdraw_proposal(pg_temp.v('g'))).status::text), 'withdrawn', '提案人撤回已還價的提案');
select throws_ok($$select public.withdraw_proposal(pg_temp.v('a'))$$, 'P0001', 'INVALID_STATE', '已成立的提案不能撤回');
select pg_temp.as_user(pg_temp.o());
select throws_ok($$select public.respond_proposal(pg_temp.v('f'), 'agree')$$, 'P0001', 'INVALID_STATE', '已撤回的提案不能同意');
reset role;
select is((select count(*)::int from public.menu_items where title in ('捶背', '洗車')), 0, '撤回不建立菜單項目');

-- ---------- AI 使用次數上限 ----------
set local role service_role;
select lives_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'proposal_review')$$, '預約第 1 次審查');
select throws_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'bogus')$$, 'P0001', 'INVALID_STATE', '未知用途被擋');
select throws_ok($$select public.internal_reserve_ai_call(gen_random_uuid(), 'support')$$, 'P0001', 'NOT_PAIRED', '不屬於任何情侶 → NOT_PAIRED');
select lives_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'proposal_review') from generate_series(1, 19)$$, '再預約 19 次(共 20)');
select throws_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'proposal_review')$$, 'P0001', 'AI_LIMIT', '第 21 次 → AI_LIMIT');
select lives_ok($$select public.internal_reserve_ai_call(pg_temp.o(), 'proposal_review')$$, '另一個人不受影響');
select lives_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'support')$$, '審查額滿,小幫手的額度另計');
select lives_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'support') from generate_series(1, 29)$$, '小幫手共 30 次');
select throws_ok($$select public.internal_reserve_ai_call(pg_temp.p(), 'support')$$, 'P0001', 'AI_LIMIT', '小幫手第 31 次 → AI_LIMIT');
reset role;
select is((select count(*)::int from public.ai_usage where user_id = pg_temp.p() and kind = 'proposal_review'), 20, '審查共記 20 次(被擋的不計)');
select is((select count(*)::int from public.ai_usage where user_id = pg_temp.p() and kind = 'support'), 30, '小幫手共記 30 次');

-- 昨天的不算今天(25 小時前一定是前一個當地日期)
insert into public.ai_usage (user_id, kind, created_at) select pg_temp.o(), 'support', now() - interval '25 hours' from generate_series(1, 40);
set local role service_role;
select lives_ok($$select public.internal_reserve_ai_call(pg_temp.o(), 'support')$$, '昨天用的次數不算今天');
reset role;

-- 次數紀錄不可改、不可讀
select throws_ok($$update public.ai_usage set kind = 'support'$$, 'P0001', 'AI_USAGE_IMMUTABLE', '次數紀錄不可修改');
select throws_ok($$delete from public.ai_usage$$, 'P0001', 'AI_USAGE_IMMUTABLE', '次數紀錄不可刪除');
select pg_temp.as_user(pg_temp.p());
select throws_ok($$select * from public.ai_usage$$, '42501', null, '使用者讀不到 ai_usage');
select throws_ok($$insert into public.ai_usage (user_id, kind) values (pg_temp.p(), 'support')$$, '42501', null, '使用者不能直接寫 ai_usage');
reset role;
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, '所有資料表(含 ai_usage)都啟用 RLS');

-- ---------- 函式安全 ----------
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  and p.proname in ('respond_proposal', 'decide_counter', 'withdraw_proposal', 'internal_create_proposal', 'internal_set_counter_review', 'internal_reserve_ai_call', '_agree_proposal')
  and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))), 0, '提案函式皆為 SECURITY DEFINER 且 search_path = ""');
select pg_temp.as_user(pg_temp.p());
select throws_ok($$select public._agree_proposal(null, 1)$$, '42501', null, '內部函式 _agree_proposal 使用者不能呼叫');
reset role;

select * from finish();
rollback;
