-- 0003 RLS、policy、欄位層級授權、撤銷多餘權限(SPEC 第 9 節)

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.ledger enable row level security;
alter table public.limit_requests enable row level security;
alter table public.service_proposals enable row level security;

-- 取得操作者所屬情侶。SECURITY DEFINER 以避免 profiles policy 自我遞迴。
create function public.current_couple_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select couple_id from public.profiles where id = (select auth.uid());
$$;
revoke all on function public.current_couple_id() from public, anon;
grant execute on function public.current_couple_id() to authenticated;

-- 先撤銷全部,再逐項授權(最小權限)。往後新建物件也預設不授權給 client 角色。
revoke all on all tables in schema public from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from public, anon;

grant select on public.couples, public.profiles, public.menu_items, public.orders,
  public.ledger, public.limit_requests, public.service_proposals, public.balances,
  public.reserved to authenticated;
-- service_role 只讀;寫入一律經函式(SECURITY DEFINER)
grant select on public.couples, public.profiles, public.menu_items, public.orders,
  public.ledger, public.limit_requests, public.service_proposals to service_role;

-- profiles:只有 nickname 可由本人更新
grant update (nickname) on public.profiles to authenticated;
-- menu_items:擁有者可新增與更新(不可改 owner / couple),不提供 DELETE
grant insert (couple_id, owner_id, title, emoji, price, active) on public.menu_items to authenticated;
grant update (title, emoji, price, active) on public.menu_items to authenticated;

create policy couples_select on public.couples for select to authenticated
  using (id = public.current_couple_id());

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or couple_id = public.current_couple_id());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy menu_items_select on public.menu_items for select to authenticated
  using (couple_id = public.current_couple_id());
create policy menu_items_insert_own on public.menu_items for insert to authenticated
  with check (owner_id = (select auth.uid()) and couple_id = public.current_couple_id());
create policy menu_items_update_own on public.menu_items for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and couple_id = public.current_couple_id());

create policy orders_select on public.orders for select to authenticated
  using (couple_id = public.current_couple_id());

-- ledger:只看得到本人的列
create policy ledger_select_own on public.ledger for select to authenticated
  using (user_id = (select auth.uid()));

create policy limit_requests_select on public.limit_requests for select to authenticated
  using (couple_id = public.current_couple_id());
create policy service_proposals_select on public.service_proposals for select to authenticated
  using (couple_id = public.current_couple_id());
