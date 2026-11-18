-- 0013 LINE 大頭貼:讓配對的兩人在首頁看到彼此的頭像。
-- 安全:使用者不能自己填網址(避免拿來追蹤對方);只能由 sync_my_avatar 從「已驗證的登入憑證」
-- (auth.jwt() 的 user_metadata)取得,而且只接受 LINE 官方圖片網址(profile.line-scdn.net)。
-- 欄位層級授權維持不變:client 只能更新 nickname。

alter table public.profiles
  add column avatar_url text
  check (avatar_url is null or avatar_url ~ '^https://profile\.line-scdn\.net/[A-Za-z0-9_./-]{1,255}$');

-- 把自己登入憑證裡的 LINE 大頭貼同步到 profile。已經一樣就不動;憑證沒有或網址不合規就不更新。
create function public.sync_my_avatar() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  v_url text := coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', ''));
  v_current text;
begin
  if v_uid is null then raise exception 'NOT_ALLOWED'; end if;
  select avatar_url into v_current from public.profiles where id = v_uid;
  if not found then raise exception 'NOT_PAIRED'; end if;

  if v_url is null or v_url !~ '^https://profile\.line-scdn\.net/[A-Za-z0-9_./-]{1,255}$' then
    return v_current;                      -- 沒有或不合規:維持原樣
  end if;
  if v_url is distinct from v_current then
    update public.profiles set avatar_url = v_url where id = v_uid;
  end if;
  return v_url;
end;
$$;

revoke all on function public.sync_my_avatar() from public, anon, service_role;
grant execute on function public.sync_my_avatar() to authenticated;
