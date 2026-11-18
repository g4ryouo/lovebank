-- 0006 配對:create_couple、join_couple(SPEC 第 5.3、8 節)
-- 錯誤代碼:INVITE_INVALID(找不到或已過期)、COUPLE_FULL(已滿 2 人)、
--           INVALID_STATE(此帳號已在某個情侶中)、NOT_ALLOWED(未登入)。

-- 邀請碼:8 碼,字元集避開易混淆的 I、O、0、1(共 32 個字元)。
create function public._new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code text := '';
  i int;
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- 建立情侶與邀請碼,並建立自己的 profile。
create function public.create_couple(p_nickname text) returns public.couples
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple public.couples;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'NOT_ALLOWED'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'INVALID_STATE';
  end if;

  loop
    begin
      insert into public.couples (invite_code, invite_expires_at)
      values (public._new_invite_code(),
              now() + make_interval(days => public._cfg('INVITE_CODE_TTL_DAYS')))
      returning * into v_couple;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;                       -- 邀請碼撞號:重新產生
      if v_try >= 10 then raise; end if;
    end;
  end loop;

  insert into public.profiles (id, couple_id, nickname)
  values (v_uid, v_couple.id, btrim(p_nickname));
  return v_couple;
end;
$$;

-- 以邀請碼加入。鎖住 couple 列後檢查人數,保證最多 2 人;
-- 第二位成員加入時設定 paired_at,雙方各寫一筆 initial。
-- 已經是此情侶成員者重複呼叫 → 無副作用的成功(防重複點擊)。
create function public.join_couple(p_code text, p_nickname text) returns public.couples
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_couple public.couples;
  v_mine public.profiles;
  v_members int;
begin
  if v_uid is null then raise exception 'NOT_ALLOWED'; end if;

  select * into v_couple from public.couples
    where invite_code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'INVITE_INVALID'; end if;

  select * into v_mine from public.profiles where id = v_uid;
  if found then
    if v_mine.couple_id = v_couple.id then return v_couple; end if;   -- 冪等
    raise exception 'INVALID_STATE';
  end if;

  select count(*) into v_members from public.profiles where couple_id = v_couple.id;
  if v_members >= 2 then raise exception 'COUPLE_FULL'; end if;
  if v_couple.invite_expires_at <= now() then raise exception 'INVITE_INVALID'; end if;

  insert into public.profiles (id, couple_id, nickname)
  values (v_uid, v_couple.id, btrim(p_nickname));

  update public.couples set paired_at = now() where id = v_couple.id
    returning * into v_couple;

  if v_couple.initial_grant > 0 then
    insert into public.ledger (couple_id, user_id, delta, reason, group_id)
    select v_couple.id, p.id, v_couple.initial_grant, 'initial', gen_random_uuid()
    from public.profiles p where p.couple_id = v_couple.id;
  end if;
  return v_couple;
end;
$$;

revoke all on function public._new_invite_code() from public, anon, authenticated, service_role;
revoke all on function public.create_couple(text), public.join_couple(text, text)
  from public, anon, service_role;
grant execute on function public.create_couple(text), public.join_couple(text, text) to authenticated;
