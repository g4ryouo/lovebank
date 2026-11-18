-- 0002 索引、view、ledger 不可變 trigger、updated_at trigger

-- 一般索引
create index profiles_couple_idx on public.profiles (couple_id);
create index menu_items_couple_owner_idx on public.menu_items (couple_id, owner_id);
create index orders_couple_status_idx on public.orders (couple_id, status);
create index orders_receiver_status_idx on public.orders (receiver_id, status);
create index orders_auto_confirm_idx on public.orders (auto_confirm_at)
  where status = 'done_by_giver';
create index orders_expires_idx on public.orders (expires_at)
  where status = 'requested';
create index ledger_user_created_idx on public.ledger (user_id, created_at);
create index limit_requests_couple_idx on public.limit_requests (couple_id);
create index service_proposals_couple_idx on public.service_proposals (couple_id);

-- DB 層最後防線(冪等與防重複發放)
create unique index ledger_order_user_uniq on public.ledger (order_id, user_id)
  where reason = 'order';
create unique index ledger_allowance_uniq on public.ledger (user_id, period_key)
  where reason = 'allowance';
create unique index ledger_initial_uniq on public.ledger (user_id)
  where reason = 'initial';
create unique index limit_requests_one_pending_uniq on public.limit_requests (requester_id)
  where status = 'pending';

-- 餘額與預留:不儲存,由 ledger / orders 計算。
-- security_invoker:以呼叫者身分套用 RLS。ledger 只看得到本人的列,
-- 所以這兩個 view 給 client 時永遠只有本人那一列(無紀錄時為 0)。
create view public.balances with (security_invoker = true) as
  select p.id as user_id, coalesce(sum(l.delta), 0)::int as balance
  from public.profiles p
  left join public.ledger l on l.user_id = p.id
  where p.id = (select auth.uid())
  group by p.id;

create view public.reserved with (security_invoker = true) as
  select p.id as user_id, coalesce(sum(o.price_snapshot), 0)::int as reserved
  from public.profiles p
  left join public.orders o
    on o.receiver_id = p.id and o.status in ('accepted', 'done_by_giver')
  where p.id = (select auth.uid())
  group by p.id;

-- ledger 只能新增:禁止 UPDATE / DELETE / TRUNCATE(含 service role)
create function public.ledger_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'LEDGER_IMMUTABLE' using errcode = 'P0001';
end;
$$;

create trigger ledger_no_update_delete
  before update or delete on public.ledger
  for each row execute function public.ledger_immutable();
create trigger ledger_no_truncate
  before truncate on public.ledger
  for each statement execute function public.ledger_immutable();

-- updated_at(用 clock_timestamp,同一交易內也會前進)
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger service_proposals_updated_at before update on public.service_proposals
  for each row execute function public.set_updated_at();
