-- 0011 撤回額度申請:申請人可以撤回自己「待處理」的申請(SPEC 第 7、8 節)。
-- 新增狀態 withdrawn;撤回者就是申請人,所以 withdrawn 與 pending 一樣沒有「決定者」。
-- 注意:新增的 enum 值在同一個交易內不能被引用,所以下面的約束與函式一律以文字比較('withdrawn')。

alter type public.limit_request_status add value if not exists 'withdrawn';

-- 以「pending 或 withdrawn ⇔ 沒有決定者」取代原本的「pending ⇔ 沒有決定者」
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.limit_requests'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%decided_by IS NULL%'
      and pg_get_constraintdef(oid) like '%pending%'
  loop
    execute format('alter table public.limit_requests drop constraint %I', c);
  end loop;
end $$;

alter table public.limit_requests
  add constraint limit_requests_decider_check
  check ((status::text in ('pending', 'withdrawn')) = (decided_by is null));

-- 申請人撤回自己待處理的申請。重複撤回 → 無副作用的成功;已被決定的申請不能撤回。
create function public.withdraw_limit_request(p_request_id uuid)
returns public.limit_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_req public.limit_requests;
begin
  select couple_id into v_couple from public.profiles where id = v_uid;
  if v_couple is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_req from public.limit_requests
    where id = p_request_id and couple_id = v_couple for update;
  if not found then raise exception 'NOT_ALLOWED'; end if;
  if v_uid <> v_req.requester_id then raise exception 'NOT_ALLOWED'; end if;   -- 只有申請人能撤回(對方用婉拒)

  if v_req.status::text = 'withdrawn' then return v_req; end if;               -- 冪等
  if v_req.status::text <> 'pending' then raise exception 'INVALID_STATE'; end if;

  update public.limit_requests set status = 'withdrawn' where id = v_req.id returning * into v_req;
  return v_req;
end;
$$;

revoke all on function public.withdraw_limit_request(uuid) from public, anon, service_role;
grant execute on function public.withdraw_limit_request(uuid) to authenticated;
