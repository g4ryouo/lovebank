-- 0010 信用額度(SPEC 5.1、第 8 節):申請、核准或婉拒、對方直接設定。
-- 規則:自己不能調自己的額度(set_credit_limit 只會設定「對方」的額度,decide 的核准者必須是另一方);
--       每人同時只有一筆待處理申請;額度上限 MAX_CREDIT_LIMIT。
-- 調低額度只影響之後的新接受,不追溯既有訂單(available 本來就是即時計算)。
-- 額度用量提醒不在 MVP 範圍。

create or replace function public._cfg(p_key text) returns int
language sql immutable set search_path = '' as $$
  select case p_key
    when 'AUTO_CONFIRM_HOURS' then 24
    when 'REQUEST_EXPIRE_DAYS' then 3
    when 'ALLOWANCE_CATCH_UP_DAYS' then 7
    when 'INVITE_CODE_TTL_DAYS' then 7
    when 'MAX_GIFT_AMOUNT' then 2000
    when 'GIFT_COOLDOWN_DAYS' then 7
    when 'MAX_CREDIT_LIMIT' then 2000
  end;
$$;

-- 對方直接設定「我」(呼叫者)以外那位成員的額度。只能設定別人的。
create function public.set_credit_limit(p_limit int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_partner uuid;
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_PAIRED'; end if;
  if p_limit is null or p_limit < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_limit > public._cfg('MAX_CREDIT_LIMIT') then raise exception 'LIMIT_TOO_HIGH'; end if;

  select id into v_partner from public.profiles where couple_id = v_couple and id <> v_uid;
  if v_partner is null then raise exception 'NOT_PAIRED'; end if;

  update public.profiles set credit_limit = p_limit where id = v_partner;
  return p_limit;
end;
$$;

-- 提出額度申請(每人同時只有一筆待處理)。
create function public.request_limit(p_requested_limit int, p_reason text default null)
returns public.limit_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_current int;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_row public.limit_requests;
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_PAIRED'; end if;
  if not exists (select 1 from public.profiles where couple_id = v_couple and id <> v_uid) then
    raise exception 'NOT_PAIRED';
  end if;
  if p_requested_limit is null or p_requested_limit < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_requested_limit > public._cfg('MAX_CREDIT_LIMIT') then raise exception 'LIMIT_TOO_HIGH'; end if;
  if v_reason is not null and char_length(v_reason) > 100 then raise exception 'INVALID_AMOUNT'; end if;

  -- 鎖自己的 profile,讓同時送出的兩個申請排隊
  select credit_limit into v_current from public.profiles where id = v_uid for update;
  if exists (select 1 from public.limit_requests where requester_id = v_uid and status = 'pending') then
    raise exception 'ALREADY_PENDING';
  end if;
  if p_requested_limit = v_current then raise exception 'INVALID_AMOUNT'; end if;

  begin
    insert into public.limit_requests (couple_id, requester_id, requested_limit, reason)
    values (v_couple, v_uid, p_requested_limit, v_reason)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'ALREADY_PENDING';       -- 唯一索引是最後防線
  end;
  return v_row;
end;
$$;

-- 另一方核准或婉拒。核准時更新申請人的額度。重複操作 → 無副作用的成功。
create function public.decide_limit_request(p_request_id uuid, p_approve boolean)
returns public.limit_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_req public.limit_requests;
  v_target public.limit_request_status;
begin
  if p_approve is null then raise exception 'INVALID_STATE'; end if;
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_req from public.limit_requests
    where id = p_request_id and couple_id = v_couple for update;
  if not found then raise exception 'NOT_ALLOWED'; end if;
  if v_uid = v_req.requester_id then raise exception 'NOT_ALLOWED'; end if;   -- 核准者必須是另一方

  v_target := case when p_approve then 'approved' else 'declined' end;
  if v_req.status = v_target then return v_req; end if;                       -- 冪等
  if v_req.status <> 'pending' then raise exception 'INVALID_STATE'; end if;

  if p_approve then
    if v_req.requested_limit > public._cfg('MAX_CREDIT_LIMIT') then raise exception 'LIMIT_TOO_HIGH'; end if;
    perform 1 from public.profiles where id = v_req.requester_id for update;
    update public.profiles set credit_limit = v_req.requested_limit where id = v_req.requester_id;
  end if;

  update public.limit_requests
    set status = v_target, decided_by = v_uid, decided_at = now()
    where id = v_req.id returning * into v_req;
  return v_req;
end;
$$;

revoke all on function public.set_credit_limit(int), public.request_limit(int, text),
  public.decide_limit_request(uuid, boolean) from public, anon, service_role;
grant execute on function public.set_credit_limit(int), public.request_limit(int, text),
  public.decide_limit_request(uuid, boolean) to authenticated;
