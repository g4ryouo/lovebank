-- 0009 贈送愛心的限制(SPEC 5.1、第 8 節):單次上限 MAX_GIFT_AMOUNT、每人每 GIFT_COOLDOWN_DAYS 天最多一次。
-- 違反時回 GIFT_LIMIT。常數與 src/lib/config.ts 一致,由 config-sync.test.ts 比對。

create or replace function public._cfg(p_key text) returns int
language sql immutable set search_path = '' as $$
  select case p_key
    when 'AUTO_CONFIRM_HOURS' then 24
    when 'REQUEST_EXPIRE_DAYS' then 3
    when 'ALLOWANCE_CATCH_UP_DAYS' then 7
    when 'INVITE_CODE_TTL_DAYS' then 7
    when 'MAX_GIFT_AMOUNT' then 2000
    when 'GIFT_COOLDOWN_DAYS' then 7
  end;
$$;

-- 贈送:兩筆分錄(贈送者 −、收禮者 +,同 group)。不可使用信用額度:balance − reserved ≥ amount。
-- 依 id 排序鎖住雙方 profile(與接受訂單、同時贈送互斥),在鎖內檢查「最近有沒有送過」。
create or replace function public.send_gift(p_amount int, p_note text default null) returns uuid
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

  if p_amount > public._cfg('MAX_GIFT_AMOUNT') then raise exception 'GIFT_LIMIT'; end if;
  if exists (
    select 1 from public.ledger
    where user_id = v_uid and reason = 'gift' and delta < 0
      and created_at > now() - make_interval(days => public._cfg('GIFT_COOLDOWN_DAYS'))
  ) then
    raise exception 'GIFT_LIMIT';
  end if;

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
