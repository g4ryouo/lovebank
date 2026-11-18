-- 本機驗證用:模擬 Supabase 的角色、auth schema、extensions schema。
-- 僅用於沒有 Docker 的環境(pnpm db:test:local),不是產品的一部分。
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
alter role anon set search_path = "$user", public, extensions;
alter role authenticated set search_path = "$user", public, extensions;
alter role service_role set search_path = "$user", public, extensions;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- 與 Supabase 相同:回傳目前請求的 JWT claims
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;

-- Supabase 預設會對 public 的新物件授權給 client 角色;模擬此行為,讓 0003 的撤銷有意義。
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
