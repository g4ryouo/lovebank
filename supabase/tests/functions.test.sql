-- T3b 驗收:訂單函式、touch_couple、send_gift。(真正的同時執行測試見 db.integration.test.ts)
begin;
select * from no_plan();

-- ---------- 輔助 ----------
create function pg_temp.g() returns uuid language sql as $$ select 'a1000000-0000-0000-0000-000000000001'::uuid $$;  -- 情侶 A:提供者(hug 擁有者)
create function pg_temp.r() returns uuid language sql as $$ select 'a2000000-0000-0000-0000-000000000002'::uuid $$;  -- 情侶 A:massage 擁有者
create function pg_temp.x() returns uuid language sql as $$ select 'b1000000-0000-0000-0000-000000000001'::uuid $$;  -- 情侶 B
create function pg_temp.nobody() returns uuid language sql as $$ select 'ff000000-0000-0000-0000-0000000000ff'::uuid $$; -- 沒有 profile
create function pg_temp.cA() returns uuid language sql as $$ select 'ca000000-0000-0000-0000-00000000000a'::uuid $$;
create function pg_temp.i(k text) returns uuid language sql as $$
  select case k
    when 'hug'  then 'e1000000-0000-0000-0000-000000000001'
    when 'free' then 'e2000000-0000-0000-0000-000000000002'
    when 'big'  then 'e3000000-0000-0000-0000-000000000003'
    when 'off'  then 'e4000000-0000-0000-0000-000000000004'
    when 'mass' then 'e5000000-0000-0000-0000-000000000005'
    when 'x'    then 'eb000000-0000-0000-0000-00000000000b'
  end::uuid $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

create temp table t (k text primary key, id uuid);
grant all on t to public;
create function pg_temp.o(k text) returns uuid language sql as $$ select id from pg_temp.t where t.k = $1 $$;

-- ---------- 資料 ----------
insert into auth.users (id, email) values
  (pg_temp.g(), 'g@t'), (pg_temp.r(), 'r@t'), (pg_temp.x(), 'x@t'),
  ('b2000000-0000-0000-0000-000000000002', 'y@t'), (pg_temp.nobody(), 'n@t');
insert into public.couples (id, invite_code, invite_expires_at, paired_at) values
  (pg_temp.cA(), 'CA', now() + interval '7 days', '2026-01-01T02:00:00Z'),
  ('cb000000-0000-0000-0000-00000000000b', 'CB', now() + interval '7 days', '2026-01-01T02:00:00Z');
insert into public.profiles (id, couple_id, nickname) values
  (pg_temp.g(), pg_temp.cA(), 'G'), (pg_temp.r(), pg_temp.cA(), 'R'),
  (pg_temp.x(), 'cb000000-0000-0000-0000-00000000000b', 'X'),
  ('b2000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-00000000000b', 'Y');
-- nobody:有 auth 使用者但沒有 profile(未配對)
insert into public.menu_items (id, couple_id, owner_id, title, emoji, price, active) values
  (pg_temp.i('hug'),  pg_temp.cA(), pg_temp.g(), 'hug', '🤗', 600, true),
  (pg_temp.i('free'), pg_temp.cA(), pg_temp.g(), 'free', '🎁', 0, true),
  (pg_temp.i('big'),  pg_temp.cA(), pg_temp.g(), 'big', '✈️', 5000, true),
  (pg_temp.i('off'),  pg_temp.cA(), pg_temp.g(), 'off', null, 100, false),
  (pg_temp.i('mass'), pg_temp.cA(), pg_temp.r(), 'mass', '💆', 300, true),
  (pg_temp.i('x'), 'cb000000-0000-0000-0000-00000000000b', pg_temp.x(), 'x item', null, 10, true);
insert into public.ledger (couple_id, user_id, delta, reason, group_id) values
  (pg_temp.cA(), pg_temp.r(), 1000, 'initial', gen_random_uuid()),
  (pg_temp.cA(), pg_temp.g(), 500, 'initial', gen_random_uuid());

-- ============ A. create_order ============
select pg_temp.as_user(pg_temp.r());
select lives_ok($$insert into pg_temp.t select 'o1', (public.create_order(pg_temp.i('hug'), '想要抱抱')).id$$, '接受者點單成功(1000 ≥ 600)');
select lives_ok($$insert into pg_temp.t select 'o2', (public.create_order(pg_temp.i('hug'))).id$$, '再點一張(requested 不預留)');
select lives_ok($$insert into pg_temp.t select 'of', (public.create_order(pg_temp.i('free'))).id$$, '價格 0 的點單成功');
select throws_ok($$select public.create_order(pg_temp.i('big'))$$, 'P0001', 'INSUFFICIENT_CREDIT', '點單時額度不足被擋下');
select throws_ok($$select public.create_order(pg_temp.i('off'))$$, 'P0001', 'ITEM_INACTIVE', '停用項目不能點');
select throws_ok($$select public.create_order(pg_temp.i('x'))$$, 'P0001', 'NOT_ALLOWED', '別的情侶的項目 → NOT_ALLOWED');
select throws_ok($$select public.create_order(gen_random_uuid())$$, 'P0001', 'NOT_ALLOWED', '不存在的項目 → NOT_ALLOWED');
select pg_temp.as_user(pg_temp.nobody());
select throws_ok($$select public.create_order(pg_temp.i('hug'))$$, 'P0001', 'NOT_PAIRED', '未配對 → NOT_PAIRED');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.create_order(pg_temp.i('hug'))$$, 'P0001', 'NOT_ALLOWED', '外人不能對別的情侶點單');
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'ob', (public.create_order(pg_temp.i('big'))).id$$, '提供者主動邀請:不檢查對方額度');
select lives_ok($$insert into pg_temp.t select 'om', (public.create_order(pg_temp.i('mass'))).id$$, '提供者以外的人點單(g 點 r 的項目,g 有 500)');
select lives_ok($$update public.menu_items set price = 999 where id = pg_temp.i('hug')$$, '改價');

reset role;
select is((select initiated_by from public.orders where id = pg_temp.o('o1')), pg_temp.r(), 'o1 發起者 = 接受者');
select is((select giver_id from public.orders where id = pg_temp.o('o1')), pg_temp.g(), 'o1 提供者 = 項目擁有者');
select is((select receiver_id from public.orders where id = pg_temp.o('o1')), pg_temp.r(), 'o1 接受者');
select is((select status::text from public.orders where id = pg_temp.o('o1')), 'requested', 'o1 為 requested');
select is((select price_snapshot from public.orders where id = pg_temp.o('o1')), 600, '改價不影響既有訂單(價格快照)');
select is((select title_snapshot || emoji_snapshot from public.orders where id = pg_temp.o('o1')), 'hug🤗', '名稱與圖示快照');
select is((select note from public.orders where id = pg_temp.o('o1')), '想要抱抱', '備註');
select is((select initiated_by from public.orders where id = pg_temp.o('ob')), pg_temp.g(), 'ob 發起者 = 提供者');
select is((select receiver_id from public.orders where id = pg_temp.o('ob')), pg_temp.r(), 'ob 接受者 = 對方');
select is((select giver_id from public.orders where id = pg_temp.o('om')), pg_temp.r(), 'om 提供者 = r(項目擁有者)');
select ok((select expires_at - created_at from public.orders where id = pg_temp.o('o1')) = interval '3 days', '邀請 3 天後過期');
select is((select count(*)::int from public.ledger where reason = 'order'), 0, '建立訂單不寫 ledger');

-- ============ B. respond_order ============
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.respond_order(pg_temp.o('o1'), true)$$, 'P0001', 'NOT_ALLOWED', '發起者不能接受自己的單');
select throws_ok($$select public.respond_order(pg_temp.o('o1'), false)$$, 'P0001', 'NOT_ALLOWED', '發起者不能婉拒自己的單');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.respond_order(pg_temp.o('o1'), true)$$, 'P0001', 'NOT_ALLOWED', '外人不能接受');
select pg_temp.as_user(pg_temp.g());
select is((select (public.respond_order(pg_temp.o('o1'), true)).status::text), 'accepted', '提供者接受 → accepted');
select is((select (public.respond_order(pg_temp.o('o1'), true)).status::text), 'accepted', '重複接受 → 無副作用的成功');
select throws_ok($$select public.respond_order(pg_temp.o('o2'), true)$$, 'P0001', 'INSUFFICIENT_CREDIT', '第二張超過可用額度(1000 − 預留 600 < 600)');
select is((select (public.respond_order(pg_temp.o('o2'), false)).status::text), 'declined', '婉拒 → declined');
select is((select (public.respond_order(pg_temp.o('o2'), false)).status::text), 'declined', '重複婉拒 → 無操作成功');
select throws_ok($$select public.respond_order(pg_temp.o('o2'), true)$$, 'P0001', 'INVALID_STATE', '已婉拒不能再接受');
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.respond_order(pg_temp.o('ob'), true)$$, 'P0001', 'INSUFFICIENT_CREDIT', '主動邀請在接受時才檢查額度');
select is((select (public.respond_order(pg_temp.o('ob'), false)).status::text), 'declined', '婉拒永遠沒有代價');
select is((select (public.respond_order(pg_temp.o('om'), true)).status::text), 'accepted', 'r 接受 g 的點單(g 有 500 ≥ 300)');
select pg_temp.as_user(pg_temp.g());
select is((select (public.respond_order(pg_temp.o('of'), true)).status::text), 'accepted', '免費單接受');

reset role;
select is(public._reserved(pg_temp.r()), 600, 'r 預留 = 600(o1)');
select is(public._available(pg_temp.r()), 400, 'r 可用 = 1000 + 0 − 600');
select is(public._reserved(pg_temp.g()), 300, 'g 預留 = 300(om)');
select is((select count(*)::int from public.ledger where reason = 'order'), 0, '婉拒與接受不影響 ledger');

-- 逾期
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'od', (public.create_order(pg_temp.i('big'))).id$$, 'g 邀請 r 做 big(為逾期測試)');
reset role;
update public.orders set expires_at = now() - interval '1 second' where id = pg_temp.o('od');
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.respond_order(pg_temp.o('od'), false)$$, 'P0001', 'INVALID_STATE', '逾期的邀請不能婉拒');
select throws_ok($$select public.respond_order(pg_temp.o('od'), true)$$, 'P0001', 'INVALID_STATE', '逾期的邀請不能接受');
select pg_temp.as_user(pg_temp.g());
select throws_ok($$select public.cancel_order(pg_temp.o('od'))$$, 'P0001', 'INVALID_STATE', '逾期的邀請不能取消');

-- ============ C. cancel_order ============
select is((select (public.cancel_order(pg_temp.o('om'))).status::text), 'cancelled', 'accepted:發起者(接受者)取消 om');
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.respond_order(pg_temp.o('om'), true)$$, 'P0001', 'INVALID_STATE', '已取消不能接受');
reset role;
select is(public._reserved(pg_temp.g()), 0, '取消 accepted 後預留釋放');
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'oc1', (public.create_order(pg_temp.i('mass'))).id$$, 'g 點 r 的 mass(oc1,requested)');
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.cancel_order(pg_temp.o('oc1'))$$, 'P0001', 'NOT_ALLOWED', 'requested:非發起者不能取消');
select pg_temp.as_user(pg_temp.x());
select throws_ok($$select public.cancel_order(pg_temp.o('oc1'))$$, 'P0001', 'NOT_ALLOWED', '外人不能取消');
select pg_temp.as_user(pg_temp.g());
select is((select (public.cancel_order(pg_temp.o('oc1'))).status::text), 'cancelled', 'requested:發起者取消');
select is((select (public.cancel_order(pg_temp.o('oc1'))).status::text), 'cancelled', '重複取消 → 無操作成功');
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'oc2', (public.create_order(pg_temp.i('mass'))).id$$, 'g 再點 mass(oc2)');
select pg_temp.as_user(pg_temp.r());
select lives_ok($$select public.respond_order(pg_temp.o('oc2'), true)$$, 'r 接受 oc2');
select is((select (public.cancel_order(pg_temp.o('oc2'))).status::text), 'cancelled', 'accepted:提供者也可取消');

-- ============ D. mark_done / confirm / waive ============
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.mark_done(pg_temp.o('o1'))$$, 'P0001', 'NOT_ALLOWED', '接受者不能按做完了');
select throws_ok($$select public.waive_order(pg_temp.o('o1'))$$, 'P0001', 'NOT_ALLOWED', '接受者不能按免費');
select throws_ok($$select public.confirm_order(pg_temp.o('o1'))$$, 'P0001', 'INVALID_STATE', 'accepted 不能直接確認');
select pg_temp.as_user(pg_temp.g());
select throws_ok($$select public.mark_done(pg_temp.o('o2'))$$, 'P0001', 'INVALID_STATE', 'declined 不能做完了');
select is((select (public.mark_done(pg_temp.o('o1'))).status::text), 'done_by_giver', '提供者做完了');
reset role;
select ok((select auto_confirm_at - done_at from public.orders where id = pg_temp.o('o1')) = interval '24 hours', 'auto_confirm_at = done_at + 24h');
create temp table snap as select auto_confirm_at from public.orders where id = pg_temp.o('o1');
select pg_temp.as_user(pg_temp.g());
select is((select (public.mark_done(pg_temp.o('o1'))).status::text), 'done_by_giver', '重複做完了 → 無操作成功');
select throws_ok($$select public.confirm_order(pg_temp.o('o1'))$$, 'P0001', 'NOT_ALLOWED', '提供者不能確認');
reset role;
select is((select auto_confirm_at from public.orders where id = pg_temp.o('o1')), (select auto_confirm_at from snap), '重複做完了不重設倒數');

select pg_temp.as_user(pg_temp.r());
select is((select (public.confirm_order(pg_temp.o('o1'))).settled_amount), 600, '接受者確認 → 完成,成交 600');
select is((select (public.confirm_order(pg_temp.o('o1'))).status::text), 'completed', '重複確認 → 無副作用的成功');
reset role;
select is((select count(*)::int from public.ledger where order_id = pg_temp.o('o1')), 2, '同一訂單只寫 2 筆 ledger');
select is((select delta from public.ledger where order_id = pg_temp.o('o1') and user_id = pg_temp.r()), -600, '接受者 −600');
select is((select delta from public.ledger where order_id = pg_temp.o('o1') and user_id = pg_temp.g()), 600, '提供者 +600');
select is((select sum(delta)::int from public.ledger where group_id = pg_temp.o('o1')), 0, '兩筆加總為 0');
select is(public._balance(pg_temp.r()), 400, 'r 餘額 = 400');
select is(public._balance(pg_temp.g()), 1100, 'g 餘額 = 1100');
select is(public._reserved(pg_temp.r()), 0, '完成後預留釋放');

-- 這次免費(提供者 = r 的 mass 項目)
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'w1', (public.create_order(pg_temp.i('mass'))).id$$, 'g 點 mass(w1)');
select lives_ok($$insert into pg_temp.t select 'w2', (public.create_order(pg_temp.i('mass'))).id$$, 'g 點 mass(w2)');
select pg_temp.as_user(pg_temp.r());
select lives_ok($$select public.respond_order(pg_temp.o('w1'), true)$$, 'r 接受 w1');
select lives_ok($$select public.respond_order(pg_temp.o('w2'), true)$$, 'r 接受 w2');
select pg_temp.as_user(pg_temp.g());
select throws_ok($$select public.waive_order(pg_temp.o('w1'))$$, 'P0001', 'NOT_ALLOWED', '接受者不能叫對方免費');
select pg_temp.as_user(pg_temp.r());
select is((select (public.waive_order(pg_temp.o('w1'))).settled_amount), 0, 'accepted 時提供者免費 → settled 0');
select is((select (public.waive_order(pg_temp.o('w1'))).status::text), 'completed', '重複免費 → 無操作成功');
select lives_ok($$select public.mark_done(pg_temp.o('w2'))$$, 'r 做完了 w2');
select is((select (public.waive_order(pg_temp.o('w2'))).settled_amount), 0, 'done_by_giver 時免費 → settled 0');
select pg_temp.as_user(pg_temp.g());
select is((select (public.confirm_order(pg_temp.o('w2'))).status::text), 'completed', '免費後接受者確認 → 無操作成功');
reset role;
select is((select count(*)::int from public.ledger where order_id in (pg_temp.o('w1'), pg_temp.o('w2'))), 0, '免費訂單不寫 ledger');

-- 價格 0 的訂單
select pg_temp.as_user(pg_temp.g());
select lives_ok($$select public.mark_done(pg_temp.o('of'))$$, 'g 完成免費單 of');
select pg_temp.as_user(pg_temp.r());
select is((select (public.confirm_order(pg_temp.o('of'))).settled_amount), 0, '價格 0 確認 → settled 0');
reset role;
select is((select count(*)::int from public.ledger where order_id = pg_temp.o('of')), 0, '價格 0 不寫 ledger');

-- 完成時不再檢查額度
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'oz', (public.create_order(pg_temp.i('mass'))).id$$, 'g 點 mass(oz)');
select pg_temp.as_user(pg_temp.r());
select lives_ok($$select public.respond_order(pg_temp.o('oz'), true)$$, 'r 接受 oz');
select lives_ok($$select public.mark_done(pg_temp.o('oz'))$$, 'r 做完了 oz');
reset role;
insert into public.ledger (couple_id, user_id, delta, reason, group_id, note)
  values (pg_temp.cA(), pg_temp.g(), -2000, 'adjustment', gen_random_uuid(), '測試:餘額變負');
select pg_temp.as_user(pg_temp.g());
select is((select (public.confirm_order(pg_temp.o('oz'))).settled_amount), 300, '餘額為負仍可完成(不再檢查額度)');
reset role;
select is(public._balance(pg_temp.g()), 1100 - 2000 - 300, '餘額可為負');

-- ============ E. touch_couple ============
-- 情侶 A paired_at = 2026-01-01T02:00Z(台北 01-01),起算日 01-02
select is((public._touch_couple_at(pg_temp.cA(), '2026-01-01T15:00:00Z')->>'allowance')::int, 0, '配對當天不發零用點數');
select is((public._touch_couple_at(pg_temp.cA(), '2026-01-01T16:00:00Z')->>'allowance')::int, 2, '隔天(當地 01-02)雙方各一筆');
select is((public._touch_couple_at(pg_temp.cA(), '2026-01-01T16:00:00Z')->>'allowance')::int, 0, '重複呼叫不重複發');
select is((select count(*)::int from public.ledger where reason = 'allowance' and user_id = pg_temp.g()), 1, 'g 只有 1 筆 allowance');
select is((select delta from public.ledger where reason = 'allowance' and user_id = pg_temp.g()), 500, '每日 500');
select is((select period_key from public.ledger where reason = 'allowance' and user_id = pg_temp.g()), '2026-01-02', 'period_key = 當地日期');
select is((public._touch_couple_at(pg_temp.cA(), '2026-01-20T04:00:00Z')->>'allowance')::int, 14, '久未開啟只補最近 7 天(雙方各 7)');
select is((select count(*)::int from public.ledger where reason = 'allowance' and user_id = pg_temp.r()), 8, 'r 共 8 筆(01-02 + 01-14~01-20)');
select is((select min(period_key) from public.ledger where reason = 'allowance' and user_id = pg_temp.r() and period_key > '2026-01-02'), '2026-01-14', '補發從最近 7 天的第一天開始');
select is((public._touch_couple_at(pg_temp.cA(), '2026-01-20T04:00:00Z')->>'allowance')::int, 0, '再次呼叫不重複');

-- 自動確認:auto_confirm_at 之後才發生
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'oa', (public.create_order(pg_temp.i('mass'))).id$$, 'g 點 mass(oa)');
select pg_temp.as_user(pg_temp.r());
select lives_ok($$select public.respond_order(pg_temp.o('oa'), true)$$, 'r 接受 oa');
select lives_ok($$select public.mark_done(pg_temp.o('oa'))$$, 'r 做完了 oa');
reset role;
update public.orders set auto_confirm_at = '2026-02-10T00:00:00Z' where id = pg_temp.o('oa');
select is((public._touch_couple_at(pg_temp.cA(), '2026-02-09T23:59:59Z')->>'auto_confirmed')::int, 0, 'auto_confirm_at 之前不自動確認');
select is((select status::text from public.orders where id = pg_temp.o('oa')), 'done_by_giver', '仍為 done_by_giver');
select is((public._touch_couple_at(pg_temp.cA(), '2026-02-10T00:00:00Z')->>'auto_confirmed')::int, 1, 'auto_confirm_at 到了自動確認');
select is((public._touch_couple_at(pg_temp.cA(), '2026-02-10T00:00:00Z')->>'auto_confirmed')::int, 0, '再次呼叫不重複');
select is((select count(*)::int from public.ledger where order_id = pg_temp.o('oa')), 2, '自動確認只寫 2 筆 ledger');
select is((select settled_amount from public.orders where id = pg_temp.o('oa')), 300, '自動確認以價格結算');

-- 自動過期
update public.orders set expires_at = '2026-03-05T00:00:00Z' where id = pg_temp.o('od');
select is((public._touch_couple_at(pg_temp.cA(), '2026-03-04T23:59:59Z')->>'expired')::int, 0, '未到期不過期');
select is((public._touch_couple_at(pg_temp.cA(), '2026-03-05T00:00:00Z')->>'expired')::int, 1, '到期 → expired');
select is((select status::text from public.orders where id = pg_temp.o('od')), 'expired', 'od 為 expired');
select is((public._touch_couple_at(pg_temp.cA(), '2026-03-05T00:00:00Z')->>'expired')::int, 0, '再次呼叫不重複');
select is((select count(*)::int from public.ledger where order_id = pg_temp.o('od')), 0, '過期不影響點數');
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.respond_order(pg_temp.o('od'), true)$$, 'P0001', 'INVALID_STATE', 'expired 不能再回應');
select pg_temp.as_user(pg_temp.g());
select throws_ok($$select public.cancel_order(pg_temp.o('od'))$$, 'P0001', 'INVALID_STATE', 'expired 不能取消');

-- 使用者版 touch_couple
select lives_ok($$select public.touch_couple()$$, '使用者可呼叫 touch_couple');
select is((public.touch_couple()->>'allowance')::int, 0, '連呼叫兩次,第二次不再發放');
select pg_temp.as_user(pg_temp.nobody());
select throws_ok($$select public.touch_couple()$$, 'P0001', 'NOT_PAIRED', '未配對呼叫 touch_couple → NOT_PAIRED');

-- ============ F. send_gift ============
reset role;
-- 先把 r 的狀態整理:新增訂單讓 r 有預留
select pg_temp.as_user(pg_temp.g());
select lives_ok($$insert into pg_temp.t select 'gr', (public.create_order(pg_temp.i('hug'))).id$$ , 'g 主動邀請 r 做 hug(gr,價格已改為 999)');
select pg_temp.as_user(pg_temp.r());
select lives_ok($$select public.respond_order(pg_temp.o('gr'), true)$$, 'r 接受 gr(999)以產生預留');
reset role;
create temp table gb as select public._balance(pg_temp.r()) as bal, public._reserved(pg_temp.r()) as res;
grant all on gb to public;
-- 贈送上限 2000:把 r 可贈送的額度(balance − reserved)壓到 1500,以便測試「不可超過 balance − reserved」
insert into public.ledger (couple_id, user_id, delta, reason, group_id, note)
  select pg_temp.cA(), pg_temp.r(), -(bal - res - 1500), 'adjustment', gen_random_uuid(), '測試:調整可贈送額度' from gb;
delete from gb;
insert into gb select public._balance(pg_temp.r()), public._reserved(pg_temp.r());
select ok((select res from gb) = 999, 'r 預留 999');
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.send_gift(0)$$, 'P0001', 'INVALID_AMOUNT', '金額 0 → INVALID_AMOUNT');
select throws_ok($$select public.send_gift(-5)$$, 'P0001', 'INVALID_AMOUNT', '負數 → INVALID_AMOUNT');
select throws_ok($$select public.send_gift(null)$$, 'P0001', 'INVALID_AMOUNT', 'null → INVALID_AMOUNT');
select throws_ok($$select public.send_gift((select bal - res + 1 from gb))$$, 'P0001', 'INSUFFICIENT_BALANCE', '不可超過 balance − reserved');
reset role;
update public.profiles set credit_limit = 100000 where id = pg_temp.r();
select pg_temp.as_user(pg_temp.r());
select throws_ok($$select public.send_gift((select bal - res + 1 from gb))$$, 'P0001', 'INSUFFICIENT_BALANCE', '有信用額度也不能用於贈送');
select lives_ok($$insert into pg_temp.t select 'gift1', public.send_gift((select bal - res from gb), '給你')$$, '剛好等於 balance − reserved 可以');
reset role;
select is((select count(*)::int from public.ledger where group_id = pg_temp.o('gift1')), 2, '贈送寫 2 筆分錄');
select is((select sum(delta)::int from public.ledger where group_id = pg_temp.o('gift1')), 0, '兩筆加總為 0');
select is((select reason::text from public.ledger where group_id = pg_temp.o('gift1') and user_id = pg_temp.g()), 'gift', 'reason = gift');
select is((select note from public.ledger where group_id = pg_temp.o('gift1') and user_id = pg_temp.g()), '給你', '備註');
select pg_temp.as_user(pg_temp.nobody());
select throws_ok($$select public.send_gift(1)$$, 'P0001', 'NOT_PAIRED', '未配對不能贈送');

-- ============ G. 全域不變量 ============
reset role;
select is((select count(*)::int from (select group_id from public.ledger where reason in ('order', 'gift')
  group by group_id having sum(delta) <> 0) bad), 0, '所有 order / gift group 的 ledger 加總為 0');
select is((select count(*)::int from (select order_id from public.ledger where reason = 'order'
  group by order_id having count(*) <> 2) bad), 0, '每張有轉點的訂單恰好 2 筆 ledger');
select is((select count(*)::int from public.orders o where status = 'completed' and settled_amount > 0
  and (select count(*) from public.ledger l where l.order_id = o.id) <> 2), 0, '成交 > 0 的訂單都恰有 2 筆分錄');
select is((select count(*)::int from public.orders o where status = 'completed' and settled_amount = 0
  and exists (select 1 from public.ledger l where l.order_id = o.id)), 0, '成交 0 的訂單沒有分錄');

-- ============ H. 函式權限 ============
set local role anon;
select throws_ok($$select public.create_order(gen_random_uuid())$$, '42501', null, 'anon 不能呼叫 create_order');
select throws_ok($$select public.touch_couple()$$, '42501', null, 'anon 不能呼叫 touch_couple');
select throws_ok($$select public.send_gift(1)$$, '42501', null, 'anon 不能呼叫 send_gift');
reset role;
set local role service_role;
select throws_ok($$select public.confirm_order(gen_random_uuid())$$, '42501', null, 'service_role 不能呼叫使用者函式');
reset role;
select pg_temp.as_user(pg_temp.g());
select throws_ok($$select public._balance(pg_temp.r())$$, '42501', null, '使用者不能呼叫內部 _balance');
select throws_ok($$select public._available(pg_temp.r())$$, '42501', null, '使用者不能呼叫內部 _available');
select throws_ok($$select public._touch_couple_at(pg_temp.cA(), now())$$, '42501', null, '使用者不能呼叫 _touch_couple_at');
select throws_ok($$select public._settle_order(null, 1)$$, '42501', null, '使用者不能呼叫 _settle_order');
reset role;
-- 所有使用者函式皆為 SECURITY DEFINER 且 search_path 為空
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('create_order','respond_order','cancel_order','mark_done','confirm_order','waive_order','touch_couple','send_gift')
  and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))), 0, '函式皆為 SECURITY DEFINER 且 search_path = ""');

select * from finish();
rollback;
