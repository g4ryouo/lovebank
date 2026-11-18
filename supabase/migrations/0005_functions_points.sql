-- 0005 讀取時補處理(touch_couple)與贈送點數(SPEC 5.3、5.4、8)

-- 核心:可注入時間(供測試與日後 pg_cron 使用)。不授權給 client。
-- 1. 補發零用點數:雙方各一筆,起算日為 paired_at 當地隔天,只補最近 N 天,冪等(唯一索引)。
-- 2. 自動確認 auto_confirm_at 已到的 done_by_giver 訂單。
-- 3. 將逾期未回應的 requested 訂單標為 expired。
create function public._touch_couple_at(p_couple uuid, p_now timestamptz)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.couples;
  v_today date;
  v_first date;
  v_member record;
  v_order public.orders;
  v_n int;
  v_granted int := 0;
  v_confirmed int := 0;
  v_expired int := 0;
begin
  select * into v_c from public.couples where id = p_couple;
  if not found then raise exception 'NOT_PAIRED'; end if;

  if v_c.paired_at is not null and v_c.daily_allowance > 0 then
    v_today := (p_now at time zone v_c.timezone)::date;
    v_first := greatest(
      (v_c.paired_at at time zone v_c.timezone)::date + 1,
      v_today - (public._cfg('ALLOWANCE_CATCH_UP_DAYS') - 1));
    if v_first <= v_today then
      for v_member in
        select id from public.profiles where couple_id = p_couple order by id
      loop
        insert into public.ledger (couple_id, user_id, delta, reason, group_id, period_key)
        select p_couple, v_member.id, v_c.daily_allowance, 'allowance',
               gen_random_uuid(), to_char(d, 'YYYY-MM-DD')
        from generate_series(v_first::timestamp, v_today::timestamp, interval '1 day') as d
        on conflict (user_id, period_key) where reason = 'allowance' do nothing;
        get diagnostics v_n = row_count;
        v_granted := v_granted + v_n;
      end loop;
    end if;
  end if;

  -- skip locked:正在被別的交易處理的訂單,由那個交易負責完成
  for v_order in
    select * from public.orders
    where couple_id = p_couple and status = 'done_by_giver' and auto_confirm_at <= p_now
    order by id for update skip locked
  loop
    perform public._settle_order(v_order, v_order.price_snapshot);
    v_confirmed := v_confirmed + 1;
  end loop;

  update public.orders set status = 'expired'
    where couple_id = p_couple and status = 'requested' and expires_at <= p_now;
  get diagnostics v_expired = row_count;

  return jsonb_build_object('allowance', v_granted, 'auto_confirmed', v_confirmed, 'expired', v_expired);
end;
$$;

create function public.touch_couple() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_couple uuid;
begin
  select couple_id into v_couple from public.profiles where id = auth.uid();
  if v_couple is null then raise exception 'NOT_PAIRED'; end if;
  return public._touch_couple_at(v_couple, now());
end;
$$;

-- 贈送點數:兩筆分錄(贈送者 −、收禮者 +,同 group)。不可使用信用額度:
-- balance − reserved ≥ amount。依 id 排序鎖住雙方 profile,避免死結並與接受訂單互斥。
create function public.send_gift(p_amount int, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_partner uuid;
  v_group uuid := gen_random_uuid();
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_PAIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select id into v_partner from public.profiles where couple_id = v_couple and id <> v_uid;
  if v_partner is null then raise exception 'NOT_PAIRED'; end if;

  perform 1 from public.profiles where id in (v_uid, v_partner) order by id for update;

  if public._balance(v_uid) - public._reserved(v_uid) < p_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.ledger (couple_id, user_id, delta, reason, group_id, note)
  values
    (v_couple, v_uid, -p_amount, 'gift', v_group, p_note),
    (v_couple, v_partner, p_amount, 'gift', v_group, p_note);
  return v_group;
end;
$$;

revoke all on function public._touch_couple_at(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.touch_couple(), public.send_gift(int, text)
  from public, anon, service_role;
grant execute on function public.touch_couple(), public.send_gift(int, text) to authenticated;
