-- 0007 加入時可放棄「只有自己、尚未配對」的情侶(避免兩人都按建立而卡死)。
-- 取代 0006 的 join_couple(create or replace;簽章不變)。
--
-- 規則:
--  * 已配對(paired_at 有值)或已有 2 位成員的情侶 → 仍然 INVALID_STATE,不能離開。
--  * 自己只是尚未配對的單人情侶 → 刪除它(含自己在其中尚未配對時建立的菜單),再加入對方的情侶。
--  * 任何一步失敗,整個交易回復(不會變成兩邊都沒有)。
--  * 鎖定順序:兩個 couple 列依 id 排序後一起鎖,避免兩人同時互相加入時死結。

create or replace function public.join_couple(p_code text, p_nickname text) returns public.couples
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_target public.couples;
  v_mine public.profiles;
  v_old_couple public.couples;
  v_members int;
begin
  if v_uid is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_target from public.couples
    where invite_code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'INVITE_INVALID'; end if;

  select * into v_mine from public.profiles where id = v_uid;
  if found and v_mine.couple_id = v_target.id then
    return v_target;                                                   -- 冪等:早已在這一對
  end if;

  -- 依 id 排序,一次鎖住對方的 couple 與自己的 couple(若有)
  perform 1 from public.couples
    where id in (v_target.id, v_mine.couple_id) order by id for update;

  -- 鎖到手後重新讀取最新狀態(期間可能被其他人加入、或被刪除)
  select * into v_target from public.couples where id = v_target.id;
  if not found then raise exception 'INVITE_INVALID'; end if;
  select * into v_mine from public.profiles where id = v_uid;
  if found and v_mine.couple_id = v_target.id then return v_target; end if;

  if found then
    -- 自己已在某個情侶:只有「單人且尚未配對」才能放棄
    select * into v_old_couple from public.couples where id = v_mine.couple_id;
    select count(*) into v_members from public.profiles where couple_id = v_old_couple.id;
    if v_old_couple.paired_at is not null or v_members <> 1 then
      raise exception 'INVALID_STATE';
    end if;
  end if;

  select count(*) into v_members from public.profiles where couple_id = v_target.id;
  if v_members >= 2 then raise exception 'COUPLE_FULL'; end if;
  if v_target.invite_expires_at <= now() then raise exception 'INVITE_INVALID'; end if;

  if v_old_couple.id is not null then
    delete from public.menu_items where couple_id = v_old_couple.id;
    delete from public.profiles where id = v_uid;
    delete from public.couples where id = v_old_couple.id;
  end if;

  insert into public.profiles (id, couple_id, nickname)
  values (v_uid, v_target.id, btrim(p_nickname));

  update public.couples set paired_at = now() where id = v_target.id
    returning * into v_target;

  if v_target.initial_grant > 0 then
    insert into public.ledger (couple_id, user_id, delta, reason, group_id)
    select v_target.id, p.id, v_target.initial_grant, 'initial', gen_random_uuid()
    from public.profiles p where p.couple_id = v_target.id;
  end if;
  return v_target;
end;
$$;

revoke all on function public.join_couple(text, text) from public, anon, service_role;
grant execute on function public.join_couple(text, text) to authenticated;
