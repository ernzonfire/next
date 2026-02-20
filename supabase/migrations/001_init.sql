-- Core extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.app_role as enum ('admin', 'user');
create type public.points_reason as enum ('event', 'redemption');

-- Utility: updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  department text,
  role public.app_role not null default 'user',
  points_balance integer not null default 0 check (points_balance >= 0),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- New user bootstrap (works for pre-created accounts too)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'user'::public.app_role)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Rewards
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  points_cost integer not null check (points_cost > 0),
  stock integer not null check (stock >= 0),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger rewards_updated_at
before update on public.rewards
for each row execute function public.set_updated_at();

-- Announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date timestamptz not null,
  points integer not null check (points > 0),
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- Event scans (dedupe by event + user)
create table public.event_scans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scanned_by uuid not null references public.profiles(id) on delete restrict,
  scanned_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Points ledger
create table public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason public.points_reason not null,
  event_id uuid references public.events(id) on delete set null,
  reward_id uuid references public.rewards(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Reward redemptions
create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  points_spent integer not null,
  created_at timestamptz not null default now()
);

-- Chat threads (one per user)
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger chat_threads_updated_at
before update on public.chat_threads
for each row execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Helper role checks
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;

-- Guard profile updates (points + role cannot be changed by regular users)
create or replace function public.restrict_profile_updates()
returns trigger
language plpgsql
as $$
begin
  -- Only the service role can change points_balance directly
  if current_user <> 'service_role' then
    if new.points_balance <> old.points_balance then
      raise exception 'points_balance is server-managed';
    end if;
  end if;

  -- Only Admin can change roles (service role bypasses)
  if new.role <> old.role and current_user <> 'service_role' then
    if not public.is_admin() then
      raise exception 'role changes require admin';
    end if;
  end if;

  return new;
end;
$$;

create trigger restrict_profiles
before update on public.profiles
for each row execute function public.restrict_profile_updates();

-- RLS
alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.events enable row level security;
alter table public.event_scans enable row level security;
alter table public.points_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles policies
create policy "Profiles: read self or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Profiles: update self or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Announcements policies
create policy "Announcements: read all"
  on public.announcements for select
  using (auth.role() = 'authenticated');

create policy "Announcements: create by admin"
  on public.announcements for insert
  with check (public.is_admin());

create policy "Announcements: update by admin"
  on public.announcements for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Announcements: delete by admin"
  on public.announcements for delete
  using (public.is_admin());

-- Events policies
create policy "Events: read all"
  on public.events for select
  using (auth.role() = 'authenticated');

create policy "Events: manage by admin"
  on public.events for all
  using (public.is_admin())
  with check (public.is_admin());

-- Event scans policies (read-only for users/admins)
create policy "Event scans: read self or admin"
  on public.event_scans for select
  using (auth.uid() = user_id or public.is_admin());

-- Points transactions policies (read-only for users/admins)
create policy "Points transactions: read self or admin"
  on public.points_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- Rewards policies
create policy "Rewards: read all"
  on public.rewards for select
  using (auth.role() = 'authenticated');

create policy "Rewards: manage by admin"
  on public.rewards for all
  using (public.is_admin())
  with check (public.is_admin());

-- Reward redemptions policies (read-only for users/admins)
create policy "Reward redemptions: read self or admin"
  on public.reward_redemptions for select
  using (auth.uid() = user_id or public.is_admin());

-- Chat threads policies
create policy "Chat threads: read own or admin"
  on public.chat_threads for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Chat threads: create own"
  on public.chat_threads for insert
  with check (auth.uid() = user_id);

create policy "Chat threads: update own or admin"
  on public.chat_threads for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- Chat messages policies
create policy "Chat messages: read own thread or admin"
  on public.chat_messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.user_id = auth.uid()
    )
  );

create policy "Chat messages: insert own thread or admin"
  on public.chat_messages for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.user_id = auth.uid()
    )
  );

-- Secure point grant (called by Edge Function with service role)
create or replace function public.grant_event_points(
  p_event_id uuid,
  p_user_id uuid,
  p_scanned_by uuid
)
returns table (new_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_balance integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_scanned_by and role in ('admin')
  ) then
    raise exception 'not authorized';
  end if;

  select points into v_points from public.events where id = p_event_id;
  if v_points is null then
    raise exception 'event not found';
  end if;

  if exists (
    select 1 from public.event_scans
    where event_id = p_event_id and user_id = p_user_id
  ) then
    raise exception 'duplicate scan';
  end if;

  select points_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'user not found';
  end if;

  insert into public.event_scans (event_id, user_id, scanned_by)
  values (p_event_id, p_user_id, p_scanned_by);

  insert into public.points_transactions (user_id, delta, reason, event_id)
  values (p_user_id, v_points, 'event', p_event_id);

  update public.profiles
  set points_balance = points_balance + v_points
  where id = p_user_id;

  return query select v_balance + v_points;
end;
$$;

-- Secure redemption (called by Edge Function with service role)
create or replace function public.redeem_reward(
  p_reward_id uuid,
  p_user_id uuid,
  p_quantity integer default 1
)
returns table (new_balance integer, redemption_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_stock integer;
  v_balance integer;
  v_total integer;
  v_redemption_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid quantity';
  end if;

  select points_cost, stock
  into v_cost, v_stock
  from public.rewards
  where id = p_reward_id and is_active = true
  for update;

  if v_cost is null then
    raise exception 'reward not found';
  end if;

  if v_stock < p_quantity then
    raise exception 'insufficient stock';
  end if;

  select points_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'user not found';
  end if;

  v_total := v_cost * p_quantity;
  if v_balance < v_total then
    raise exception 'insufficient points';
  end if;

  update public.rewards
  set stock = stock - p_quantity
  where id = p_reward_id;

  insert into public.reward_redemptions (reward_id, user_id, quantity, points_spent)
  values (p_reward_id, p_user_id, p_quantity, v_total)
  returning id into v_redemption_id;

  insert into public.points_transactions (user_id, delta, reason, reward_id)
  values (p_user_id, -v_total, 'redemption', p_reward_id);

  update public.profiles
  set points_balance = points_balance - v_total
  where id = p_user_id;

  return query select v_balance - v_total, v_redemption_id;
end;
$$;

-- Lock down function execution to service role
revoke all on function public.grant_event_points(uuid, uuid, uuid) from public;
revoke all on function public.redeem_reward(uuid, uuid, integer) from public;
grant execute on function public.grant_event_points(uuid, uuid, uuid) to service_role;
grant execute on function public.redeem_reward(uuid, uuid, integer) to service_role;
