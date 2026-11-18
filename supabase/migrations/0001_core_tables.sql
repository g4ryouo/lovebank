-- 0001 核心資料表與 enum(SPEC 第 7 節)。約束只能比 SPEC 更嚴,不得放寬。

create type public.order_status as enum
  ('requested', 'accepted', 'done_by_giver', 'completed', 'declined', 'cancelled', 'expired');
create type public.ledger_reason as enum
  ('initial', 'allowance', 'order', 'gift', 'adjustment');
create type public.proposal_status as enum
  ('pending', 'countered', 'agreed', 'rejected', 'withdrawn');
create type public.limit_request_status as enum
  ('pending', 'approved', 'declined');
create type public.ai_verdict as enum
  ('ok', 'caution', 'unavailable');

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  invite_expires_at timestamptz not null,
  timezone text not null default 'Asia/Taipei',
  daily_allowance int not null default 500 check (daily_allowance >= 0),
  initial_grant int not null default 2000 check (initial_grant >= 0),
  paired_at timestamptz,
  created_at timestamptz not null default now()
);

-- 一個 couple 最多 2 位成員,由 join_couple 函式在鎖內保證(T4)。
create table public.profiles (
  id uuid primary key references auth.users (id),
  couple_id uuid references public.couples (id),
  nickname text not null check (char_length(nickname) between 1 and 20),
  credit_limit int not null default 0 check (credit_limit >= 0),
  created_at timestamptz not null default now(),
  unique (id, couple_id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 40),
  emoji text,
  price int not null check (price between 0 and 100000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, couple_id) references public.profiles (id, couple_id),
  unique (id, owner_id, couple_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  menu_item_id uuid not null,
  giver_id uuid not null,
  receiver_id uuid not null,
  initiated_by uuid not null,
  price_snapshot int not null check (price_snapshot >= 0),
  title_snapshot text not null,
  emoji_snapshot text,
  status public.order_status not null default 'requested',
  settled_amount int,
  note text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  done_at timestamptz,
  auto_confirm_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (giver_id <> receiver_id),
  check (initiated_by in (giver_id, receiver_id)),
  check ((status = 'completed') = (settled_amount is not null)),
  check (settled_amount is null or settled_amount between 0 and price_snapshot),
  foreign key (menu_item_id, giver_id, couple_id)
    references public.menu_items (id, owner_id, couple_id),
  foreign key (receiver_id, couple_id) references public.profiles (id, couple_id)
);

create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  user_id uuid not null,
  delta int not null check (delta <> 0),
  reason public.ledger_reason not null,
  group_id uuid not null,
  order_id uuid references public.orders (id),
  period_key text,
  note text,
  created_at timestamptz not null default now(),
  foreign key (user_id, couple_id) references public.profiles (id, couple_id),
  check (reason <> 'order' or order_id is not null),
  check (reason <> 'allowance' or period_key is not null),
  check (period_key is null or period_key ~ '^\d{4}-\d{2}-\d{2}$'),
  check (reason <> 'adjustment' or note is not null)
);

create table public.limit_requests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  requester_id uuid not null,
  requested_limit int not null check (requested_limit >= 0),
  reason text,
  status public.limit_request_status not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (requester_id, couple_id) references public.profiles (id, couple_id),
  foreign key (decided_by, couple_id) references public.profiles (id, couple_id),
  -- 核准者必須是另一位成員;待處理時尚無決定者
  check (decided_by is null or decided_by <> requester_id),
  check ((status = 'pending') = (decided_by is null))
);

create table public.service_proposals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  proposer_id uuid not null,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 40),
  emoji text,
  price int not null check (price between 0 and 100000),
  status public.proposal_status not null default 'pending',
  counter_price int check (counter_price between 0 and 100000),
  ai_verdict public.ai_verdict,
  ai_comment text,
  ai_reviewed_at timestamptz,
  counter_ai_verdict public.ai_verdict,
  counter_ai_comment text,
  menu_item_id uuid references public.menu_items (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (proposer_id, couple_id) references public.profiles (id, couple_id),
  foreign key (owner_id, couple_id) references public.profiles (id, couple_id),
  check (proposer_id <> owner_id)
);
