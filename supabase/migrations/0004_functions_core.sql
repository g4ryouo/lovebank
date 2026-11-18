-- 0004 訂單核心函式(SPEC 第 6、8 節)
-- 共通規則:SECURITY DEFINER、search_path = ''、以 auth.uid() 取得操作者(不接受 client 傳入使用者 id)。
-- 檢查順序:先權限(NOT_ALLOWED)→ 再狀態(INVALID_STATE)。已在目標狀態且有權限 → 無副作用的成功。
-- 鎖定順序:orders → profiles(多個 profile 依 id 排序)。
-- 這些規則必須與 src/lib/points/ 的純函式一致。

-- 規則常數(需與 src/lib/config.ts 一致,由 config-sync.test.ts 比對)
create function public._cfg(p_key text) returns int
language sql immutable set search_path = '' as $$
  select case p_key
    when 'AUTO_CONFIRM_HOURS' then 24
    when 'REQUEST_EXPIRE_DAYS' then 3
    when 'ALLOWANCE_CATCH_UP_DAYS' then 7
  end;
$$;

-- ---------- 內部輔助(不授權給任何 client 角色) ----------

create function public._balance(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(delta), 0)::int from public.ledger where user_id = p_user;
$$;

create function public._reserved(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(price_snapshot), 0)::int from public.orders
  where receiver_id = p_user and status in ('accepted', 'done_by_giver');
$$;

-- available = balance + credit_limit − reserved
create function public._available(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select public._balance(p_user) + p.credit_limit - public._reserved(p_user)
  from public.profiles p where p.id = p_user;
$$;

-- 取得並鎖住訂單;操作者必須是該訂單的成員,否則 NOT_ALLOWED(不洩漏訂單是否存在)
create function public._lock_order(p_order_id uuid) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_order public.orders;
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;
  select * into v_order from public.orders
    where id = p_order_id and couple_id = v_couple for update;
  if not found or v_uid not in (v_order.giver_id, v_order.receiver_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  return v_order;
end;
$$;

-- 完成訂單:同一交易內寫兩筆 ledger(接受者 −、提供者 +);金額 0 不寫帳。
-- 呼叫者必須已持有該訂單的鎖,且已確認來源狀態合法。
create function public._settle_order(p_order public.orders, p_amount int) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  if p_amount < 0 or p_amount > p_order.price_snapshot then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_amount > 0 then
    insert into public.ledger (couple_id, user_id, delta, reason, group_id, order_id)
    values
      (p_order.couple_id, p_order.receiver_id, -p_amount, 'order', p_order.id, p_order.id),
      (p_order.couple_id, p_order.giver_id, p_amount, 'order', p_order.id, p_order.id);
  end if;
  update public.orders
    set status = 'completed', settled_amount = p_amount, completed_at = now()
    where id = p_order.id
    returning * into v_order;
  return v_order;
end;
$$;

-- ---------- 對 client 開放的函式 ----------

-- 建立訂單。接受者發起 = 點單(檢查額度);提供者發起 = 主動邀請(不檢查)。
create function public.create_order(p_menu_item_id uuid, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_item public.menu_items;
  v_receiver uuid;
  v_order public.orders;
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_PAIRED'; end if;

  select * into v_item from public.menu_items
    where id = p_menu_item_id and couple_id = v_couple for share;
  if not found then raise exception 'NOT_ALLOWED'; end if;
  if not v_item.active then raise exception 'ITEM_INACTIVE'; end if;

  if v_uid = v_item.owner_id then
    select id into v_receiver from public.profiles
      where couple_id = v_couple and id <> v_uid;
  else
    v_receiver := v_uid;
  end if;
  if v_receiver is null then raise exception 'NOT_PAIRED'; end if;

  -- 價格 0 不花愛心,不檢查額度
  if v_uid = v_receiver and v_item.price > 0
     and public._available(v_receiver) < v_item.price then
    raise exception 'INSUFFICIENT_CREDIT';
  end if;

  insert into public.orders (couple_id, menu_item_id, giver_id, receiver_id, initiated_by,
    price_snapshot, title_snapshot, emoji_snapshot, note, expires_at)
  values (v_couple, v_item.id, v_item.owner_id, v_receiver, v_uid,
    v_item.price, v_item.title, v_item.emoji, p_note,
    now() + make_interval(days => public._cfg('REQUEST_EXPIRE_DAYS')))
  returning * into v_order;
  return v_order;
end;
$$;

-- 回應者接受或婉拒。接受時做權威額度檢查(鎖定接受者 profile 後在鎖內計算)。
create function public.respond_order(p_order_id uuid, p_accept boolean)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_target public.order_status;
begin
  if p_accept is null then raise exception 'INVALID_STATE'; end if;
  v_order := public._lock_order(p_order_id);
  v_target := case when p_accept then 'accepted' else 'declined' end;

  -- 權限:回應者 = 不是發起者的那一方
  if v_uid = v_order.initiated_by then raise exception 'NOT_ALLOWED'; end if;

  if v_order.status = v_target then return v_order; end if;       -- 冪等
  if v_order.status <> 'requested' then raise exception 'INVALID_STATE'; end if;
  if v_order.expires_at is not null and v_order.expires_at <= now() then
    raise exception 'INVALID_STATE';                                -- 已逾期,等 touch_couple 標為 expired
  end if;

  if p_accept then
    perform 1 from public.profiles where id = v_order.receiver_id for update;
    if v_order.price_snapshot > 0
       and public._available(v_order.receiver_id) < v_order.price_snapshot then
      raise exception 'INSUFFICIENT_CREDIT';
    end if;
    update public.orders set status = 'accepted', accepted_at = now()
      where id = v_order.id returning * into v_order;
  else
    update public.orders set status = 'declined'
      where id = v_order.id returning * into v_order;
  end if;
  return v_order;
end;
$$;

-- 取消:requested 只有發起者;accepted 任一方。
create function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  v_order := public._lock_order(p_order_id);

  if v_order.status = 'requested' and v_uid <> v_order.initiated_by then
    raise exception 'NOT_ALLOWED';
  end if;

  if v_order.status = 'cancelled' then return v_order; end if;    -- 冪等
  if v_order.status not in ('requested', 'accepted') then raise exception 'INVALID_STATE'; end if;
  if v_order.status = 'requested' and v_order.expires_at is not null
     and v_order.expires_at <= now() then
    raise exception 'INVALID_STATE';
  end if;

  update public.orders set status = 'cancelled'
    where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;

-- 提供者按「做完了」,啟動 24 小時自動確認倒數。
create function public.mark_done(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  v_order := public._lock_order(p_order_id);
  if auth.uid() <> v_order.giver_id then raise exception 'NOT_ALLOWED'; end if;

  if v_order.status = 'done_by_giver' then return v_order; end if; -- 冪等
  if v_order.status <> 'accepted' then raise exception 'INVALID_STATE'; end if;

  update public.orders
    set status = 'done_by_giver', done_at = now(),
        auto_confirm_at = now() + make_interval(hours => public._cfg('AUTO_CONFIRM_HOURS'))
    where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;

-- 接受者確認並轉點(冪等:重複確認不會重複寫帳)。
create function public.confirm_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  v_order := public._lock_order(p_order_id);
  if auth.uid() <> v_order.receiver_id then raise exception 'NOT_ALLOWED'; end if;

  if v_order.status = 'completed' then return v_order; end if;     -- 冪等
  if v_order.status <> 'done_by_giver' then raise exception 'INVALID_STATE'; end if;

  return public._settle_order(v_order, v_order.price_snapshot);
end;
$$;

-- 提供者「這次免費」:成交金額 0,不寫 ledger。
create function public.waive_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  v_order := public._lock_order(p_order_id);
  if auth.uid() <> v_order.giver_id then raise exception 'NOT_ALLOWED'; end if;

  if v_order.status = 'completed' then return v_order; end if;     -- 冪等
  if v_order.status not in ('accepted', 'done_by_giver') then raise exception 'INVALID_STATE'; end if;

  return public._settle_order(v_order, 0);
end;
$$;

-- ---------- 授權 ----------
revoke all on function public._cfg(text), public._balance(uuid), public._reserved(uuid),
  public._available(uuid), public._lock_order(uuid), public._settle_order(public.orders, int)
  from public, anon, authenticated, service_role;

revoke all on function public.create_order(uuid, text), public.respond_order(uuid, boolean),
  public.cancel_order(uuid), public.mark_done(uuid), public.confirm_order(uuid),
  public.waive_order(uuid) from public, anon, service_role;
grant execute on function public.create_order(uuid, text), public.respond_order(uuid, boolean),
  public.cancel_order(uuid), public.mark_done(uuid), public.confirm_order(uuid),
  public.waive_order(uuid) to authenticated;
