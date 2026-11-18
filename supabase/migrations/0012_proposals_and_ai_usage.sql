-- 0012 服務提案(SPEC 第 11 節)與 AI 使用次數紀錄。
-- 提案流程:pending → 對方同意/婉拒/還價(一次,經伺服器 AI 審查)→ 成立時在「對方」菜單建立項目。
-- AI 只給意見,不能否決。internal_* 只授權給 service_role(由伺服器 route 在確認使用者身分後呼叫)。

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
    when 'MAX_PRICE' then 100000
    when 'AI_REVIEWS_PER_DAY' then 20
    when 'SUPPORT_MESSAGES_PER_DAY' then 30
  end;
$$;

-- AI 使用次數:只記「誰、哪一種、何時」,不記任何內容。只能新增。
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('proposal_review', 'support')),
  created_at timestamptz not null default now()
);
create index ai_usage_user_kind_created_idx on public.ai_usage (user_id, kind, created_at);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public, anon, authenticated, service_role;

create function public.ai_usage_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'AI_USAGE_IMMUTABLE' using errcode = 'P0001';
end;
$$;
create trigger ai_usage_no_update_delete before update or delete on public.ai_usage
  for each row execute function public.ai_usage_immutable();

-- 預約一次 AI 呼叫:在「情侶時區的今天」內,超過上限就回 AI_LIMIT。
-- 先鎖住使用者 profile,讓同時送出的呼叫排隊,上限才不會被同時穿透。
create function public.internal_reserve_ai_call(p_actor uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text;
  v_limit int;
  v_used int;
begin
  if p_kind not in ('proposal_review', 'support') then raise exception 'INVALID_STATE'; end if;
  select c.timezone into v_tz
    from public.profiles p join public.couples c on c.id = p.couple_id
    where p.id = p_actor;
  if v_tz is null then raise exception 'NOT_PAIRED'; end if;

  perform 1 from public.profiles where id = p_actor for update;

  v_limit := case p_kind
    when 'proposal_review' then public._cfg('AI_REVIEWS_PER_DAY')
    else public._cfg('SUPPORT_MESSAGES_PER_DAY') end;
  select count(*) into v_used from public.ai_usage
    where user_id = p_actor and kind = p_kind
      and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date;
  if v_used >= v_limit then raise exception 'AI_LIMIT'; end if;

  insert into public.ai_usage (user_id, kind) values (p_actor, p_kind);
end;
$$;

-- 建立提案並寫入 AI 審查結果。項目將加入「對方」的菜單。
create function public.internal_create_proposal(
  p_actor uuid, p_title text, p_emoji text, p_price int,
  p_verdict public.ai_verdict, p_comment text
) returns public.service_proposals
language plpgsql security definer set search_path = '' as $$
declare
  v_couple uuid;
  v_owner uuid;
  v_row public.service_proposals;
begin
  select couple_id into v_couple from public.profiles where id = p_actor;
  if v_couple is null then raise exception 'NOT_PAIRED'; end if;
  select id into v_owner from public.profiles where couple_id = v_couple and id <> p_actor;
  if v_owner is null then raise exception 'NOT_PAIRED'; end if;

  insert into public.service_proposals (couple_id, proposer_id, owner_id, title, emoji, price,
    ai_verdict, ai_comment, ai_reviewed_at)
  values (v_couple, p_actor, v_owner, btrim(p_title), nullif(btrim(coalesce(p_emoji, '')), ''), p_price,
    coalesce(p_verdict, 'unavailable'), left(p_comment, 500),
    case when p_verdict in ('ok', 'caution') then now() end)
  returning * into v_row;
  return v_row;
end;
$$;

-- 還價(只能一次):由「對方(項目擁有者)」發起,並寫入價格的 AI 審查結果。
create function public.internal_set_counter_review(
  p_id uuid, p_actor uuid, p_counter_price int,
  p_verdict public.ai_verdict, p_comment text
) returns public.service_proposals
language plpgsql security definer set search_path = '' as $$
declare
  v_couple uuid;
  v_row public.service_proposals;
begin
  select couple_id into v_couple from public.profiles where id = p_actor;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_row from public.service_proposals where id = p_id and couple_id = v_couple for update;
  if not found or v_row.owner_id <> p_actor then raise exception 'NOT_ALLOWED'; end if;
  if v_row.status <> 'pending' then raise exception 'INVALID_STATE'; end if;     -- 還價只能一次
  if p_counter_price is null or p_counter_price < 0 or p_counter_price > public._cfg('MAX_PRICE')
     or p_counter_price = v_row.price then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.service_proposals
    set status = 'countered', counter_price = p_counter_price,
        counter_ai_verdict = coalesce(p_verdict, 'unavailable'), counter_ai_comment = left(p_comment, 500)
    where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- 成立:在擁有者的菜單建立項目(價格 = 同意的價格)。呼叫者必須已持有提案列的鎖。
create function public._agree_proposal(p_row public.service_proposals, p_price int) returns public.service_proposals
language plpgsql security definer set search_path = '' as $$
declare
  v_item uuid;
  v_row public.service_proposals;
begin
  insert into public.menu_items (couple_id, owner_id, title, emoji, price)
  values (p_row.couple_id, p_row.owner_id, p_row.title, p_row.emoji, p_price)
  returning id into v_item;
  update public.service_proposals set status = 'agreed', menu_item_id = v_item
    where id = p_row.id returning * into v_row;
  return v_row;
end;
$$;

-- 對方(擁有者)同意或婉拒。還價走伺服器 route(要先做價格審查),不在這裡。
create function public.respond_proposal(p_id uuid, p_action text) returns public.service_proposals
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.service_proposals;
begin
  if p_action not in ('agree', 'reject') then raise exception 'INVALID_STATE'; end if;
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_row from public.service_proposals where id = p_id and couple_id = v_couple for update;
  if not found or v_row.owner_id <> v_uid then raise exception 'NOT_ALLOWED'; end if;

  if p_action = 'agree' and v_row.status = 'agreed' then return v_row; end if;       -- 冪等
  if p_action = 'reject' and v_row.status = 'rejected' then return v_row; end if;
  if v_row.status <> 'pending' then raise exception 'INVALID_STATE'; end if;

  if p_action = 'agree' then return public._agree_proposal(v_row, v_row.price); end if;
  update public.service_proposals set status = 'rejected' where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- 提案人對還價:接受(價格 = 還價)或婉拒。
create function public.decide_counter(p_id uuid, p_accept boolean) returns public.service_proposals
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.service_proposals;
begin
  if p_accept is null then raise exception 'INVALID_STATE'; end if;
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_row from public.service_proposals where id = p_id and couple_id = v_couple for update;
  if not found or v_row.proposer_id <> v_uid then raise exception 'NOT_ALLOWED'; end if;

  if p_accept and v_row.status = 'agreed' then return v_row; end if;                 -- 冪等
  if not p_accept and v_row.status = 'rejected' then return v_row; end if;
  if v_row.status <> 'countered' then raise exception 'INVALID_STATE'; end if;

  if p_accept then return public._agree_proposal(v_row, v_row.counter_price); end if;
  update public.service_proposals set status = 'rejected' where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- 提案人撤回(待回應或已還價時)。
create function public.withdraw_proposal(p_id uuid) returns public.service_proposals
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.service_proposals;
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_row from public.service_proposals where id = p_id and couple_id = v_couple for update;
  if not found or v_row.proposer_id <> v_uid then raise exception 'NOT_ALLOWED'; end if;

  if v_row.status = 'withdrawn' then return v_row; end if;                           -- 冪等
  if v_row.status not in ('pending', 'countered') then raise exception 'INVALID_STATE'; end if;

  update public.service_proposals set status = 'withdrawn' where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- ---------- 授權 ----------
revoke all on function public.ai_usage_immutable(), public._agree_proposal(public.service_proposals, int)
  from public, anon, authenticated, service_role;
revoke all on function
  public.internal_reserve_ai_call(uuid, text),
  public.internal_create_proposal(uuid, text, text, int, public.ai_verdict, text),
  public.internal_set_counter_review(uuid, uuid, int, public.ai_verdict, text)
  from public, anon, authenticated;
grant execute on function
  public.internal_reserve_ai_call(uuid, text),
  public.internal_create_proposal(uuid, text, text, int, public.ai_verdict, text),
  public.internal_set_counter_review(uuid, uuid, int, public.ai_verdict, text)
  to service_role;
revoke all on function public.respond_proposal(uuid, text), public.decide_counter(uuid, boolean),
  public.withdraw_proposal(uuid) from public, anon, service_role;
grant execute on function public.respond_proposal(uuid, text), public.decide_counter(uuid, boolean),
  public.withdraw_proposal(uuid) to authenticated;
