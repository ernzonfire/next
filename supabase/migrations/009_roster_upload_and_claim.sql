create extension if not exists "pgcrypto";

-- Employees roster source
create table if not exists public.employees (
  employee_id text primary key,
  surname text not null,
  first_name text,
  department text,
  status text not null default 'active' check (status in ('active', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- Admin audit trail for roster uploads
create table if not exists public.roster_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now(),
  file_name text,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  terminated_count integer not null default 0,
  error_count integer not null default 0
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'roster_uploads_uploaded_by_fkey'
  ) then
    alter table public.roster_uploads
      add constraint roster_uploads_uploaded_by_fkey
      foreign key (uploaded_by) references auth.users(id) on delete restrict;
  end if;
end $$;

-- Profiles: allow pre-claim rows and keep auth link in auth_user_id
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists disabled_at timestamptz;

-- Ensure claimed flag still exists for compatibility with existing UI
alter table public.profiles
  add column if not exists claimed boolean not null default false;

-- Normalize role to text and remove old enum dependency
alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type text
  using (
    case
      when role::text = 'user' then 'employee'
      when role::text = 'vp_admin' then 'admin'
      else role::text
    end
  );

update public.profiles
set role = 'employee'
where role is null or role = '' or role = 'user';

alter table public.profiles
  alter column role set default 'employee';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'employee', 'committee'));
  end if;
end $$;

-- Best-effort drop of old enum if no longer referenced
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    BEGIN
      DROP TYPE public.app_role;
    EXCEPTION
      WHEN dependent_objects_still_exist THEN
        null;
    END;
  END IF;
END $$;

-- Backfill auth_user_id + claimed_at from existing auth-linked rows
update public.profiles p
set auth_user_id = p.id
where p.auth_user_id is null
  and exists (select 1 from auth.users u where u.id = p.id);

update public.profiles
set claimed_at = coalesce(claimed_at, updated_at, created_at, now())
where claimed = true
  and claimed_at is null;

update public.profiles
set claimed = true
where claimed_at is not null;

-- Keep employee_id populated and referenceable
alter table public.profiles
  add column if not exists employee_id text;

alter table public.profiles
  drop constraint if exists profiles_employee_id_format;

update public.profiles p
set employee_id = split_part(u.email, '@', 1)
from auth.users u
where (p.auth_user_id = u.id or p.id = u.id)
  and p.employee_id is null
  and split_part(u.email, '@', 1) ~ '^[0-9]{5,7}$';

update public.profiles
set employee_id = 'legacy-' || substr(replace(id::text, '-', ''), 1, 12)
where employee_id is null;

-- Seed employees table from any existing profiles
insert into public.employees (employee_id, surname, first_name, department, status)
select
  p.employee_id,
  coalesce(nullif(p.last_name, ''), nullif(split_part(p.full_name, ' ', 2), ''), 'Unknown'),
  nullif(p.first_name, ''),
  p.department,
  case when p.disabled_at is not null then 'terminated' else 'active' end
from public.profiles p
on conflict (employee_id) do update
set
  surname = excluded.surname,
  first_name = coalesce(excluded.first_name, employees.first_name),
  department = coalesce(excluded.department, employees.department),
  status = case
    when employees.status = 'terminated' then 'terminated'
    else excluded.status
  end,
  updated_at = now();

alter table public.profiles
  alter column employee_id set not null;

drop index if exists public.profiles_employee_id_unique;
create unique index if not exists profiles_employee_id_key
  on public.profiles (employee_id);

create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id)
  where auth_user_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_auth_user_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_employee_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_employee_id_fkey
      foreign key (employee_id) references public.employees(employee_id)
      on update cascade
      on delete restrict;
  end if;
end $$;

-- Helper: resolve current profile id from auth uid
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid() or p.id = auth.uid()
  limit 1;
$$;

-- Helper: used by restrictive policies + feature guards
create or replace function public.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.employees e on e.employee_id = p.employee_id
    where (p.auth_user_id = auth.uid() or p.id = auth.uid())
      and p.disabled_at is null
      and e.status = 'active'
  );
$$;

-- Override admin helper to use profile role (not JWT app_metadata only)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.auth_user_id = auth.uid() or p.id = auth.uid())
      and p.role = 'admin'
      and p.disabled_at is null
  );
$$;

-- Keep auth trigger compatible with pre-created profile rows.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_department text;
  v_role text;
begin
  v_employee_id := coalesce(
    nullif(new.raw_user_meta_data->>'employee_id', ''),
    case
      when split_part(new.email, '@', 1) ~ '^[0-9]{5,7}$' then split_part(new.email, '@', 1)
      else null
    end
  );

  v_first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  v_full_name := nullif(new.raw_user_meta_data->>'full_name', '');
  v_department := nullif(new.raw_user_meta_data->>'department', '');

  if v_full_name is null then
    v_full_name := trim(concat_ws(' ', v_first_name, v_last_name));
  end if;

  v_role := case coalesce(new.raw_app_meta_data->>'role', '')
    when 'admin' then 'admin'
    when 'committee' then 'committee'
    when 'employee' then 'employee'
    when 'user' then 'employee'
    else 'employee'
  end;

  if v_employee_id is not null then
    insert into public.employees (employee_id, surname, first_name, department, status)
    values (
      v_employee_id,
      coalesce(v_last_name, 'Unknown'),
      v_first_name,
      v_department,
      'active'
    )
    on conflict (employee_id) do update
    set
      surname = coalesce(excluded.surname, employees.surname),
      first_name = coalesce(excluded.first_name, employees.first_name),
      department = coalesce(excluded.department, employees.department),
      updated_at = now();

    update public.profiles
    set
      id = new.id,
      auth_user_id = new.id,
      full_name = coalesce(nullif(v_full_name, ''), full_name),
      first_name = coalesce(v_first_name, first_name),
      last_name = coalesce(v_last_name, last_name),
      department = coalesce(v_department, department),
      role = coalesce(role, v_role),
      claimed = true,
      claimed_at = coalesce(claimed_at, now()),
      updated_at = now()
    where employee_id = v_employee_id
      and (auth_user_id is null or auth_user_id = new.id);

    if found then
      return new;
    end if;
  end if;

  insert into public.profiles (
    id,
    auth_user_id,
    employee_id,
    full_name,
    department,
    role,
    claimed,
    claimed_at,
    first_name,
    last_name,
    job_title,
    campaign,
    site,
    work_arrangement,
    dob_text
  )
  values (
    new.id,
    new.id,
    coalesce(v_employee_id, 'legacy-' || substr(replace(new.id::text, '-', ''), 1, 12)),
    coalesce(v_full_name, ''),
    v_department,
    v_role,
    true,
    now(),
    v_first_name,
    v_last_name,
    nullif(new.raw_user_meta_data->>'job_title', ''),
    nullif(new.raw_user_meta_data->>'campaign', ''),
    nullif(new.raw_user_meta_data->>'site', ''),
    nullif(new.raw_user_meta_data->>'work_arrangement', ''),
    nullif(new.raw_user_meta_data->>'dob_text', '')
  )
  on conflict (id) do update
  set
    auth_user_id = excluded.auth_user_id,
    employee_id = coalesce(profiles.employee_id, excluded.employee_id),
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    department = coalesce(excluded.department, profiles.department),
    role = coalesce(profiles.role, excluded.role),
    claimed = true,
    claimed_at = coalesce(profiles.claimed_at, excluded.claimed_at),
    first_name = coalesce(excluded.first_name, profiles.first_name),
    last_name = coalesce(excluded.last_name, profiles.last_name);

  return new;
end;
$$;

-- Restrictive policy to block disabled/terminated users across app tables
drop policy if exists "Profiles: active access" on public.profiles;
create policy "Profiles: active access"
  on public.profiles
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Announcements: active access" on public.announcements;
create policy "Announcements: active access"
  on public.announcements
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Events: active access" on public.events;
create policy "Events: active access"
  on public.events
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Event scans: active access" on public.event_scans;
create policy "Event scans: active access"
  on public.event_scans
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Points transactions: active access" on public.points_transactions;
create policy "Points transactions: active access"
  on public.points_transactions
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Rewards: active access" on public.rewards;
create policy "Rewards: active access"
  on public.rewards
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Reward redemptions: active access" on public.reward_redemptions;
create policy "Reward redemptions: active access"
  on public.reward_redemptions
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Chat threads: active access" on public.chat_threads;
create policy "Chat threads: active access"
  on public.chat_threads
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

drop policy if exists "Chat messages: active access" on public.chat_messages;
create policy "Chat messages: active access"
  on public.chat_messages
  as restrictive
  for all
  using (public.is_admin() or public.is_current_user_active())
  with check (public.is_admin() or public.is_current_user_active());

alter table public.employees enable row level security;
alter table public.roster_uploads enable row level security;

drop policy if exists "Employees: admin read" on public.employees;
create policy "Employees: admin read"
  on public.employees
  for select
  using (public.is_admin());

drop policy if exists "Employees: admin manage" on public.employees;
create policy "Employees: admin manage"
  on public.employees
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Roster uploads: admin read" on public.roster_uploads;
create policy "Roster uploads: admin read"
  on public.roster_uploads
  for select
  using (public.is_admin());

drop policy if exists "Roster uploads: admin insert" on public.roster_uploads;
create policy "Roster uploads: admin insert"
  on public.roster_uploads
  for insert
  with check (public.is_admin());

-- Explicitly guard point/reward secure functions against disabled/terminated users
create or replace function public.grant_event_points(
  p_event_id uuid,
  p_user_id uuid,
  p_scanned_by uuid
)
returns table (new_balance integer, points_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_balance integer;
  v_event_date timestamptz;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_disabled_at timestamptz;
  v_status text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_scanned_by and role in ('admin') and disabled_at is null
  ) and p_scanned_by <> p_user_id then
    raise exception 'not authorized';
  end if;

  select event_date, points into v_event_date, v_points
  from public.events
  where id = p_event_id;

  if v_event_date is null or v_points is null then
    raise exception 'event not found';
  end if;

  v_window_start := v_event_date - interval '30 minutes';
  v_window_end := v_event_date + interval '1 hour';

  if v_now < v_window_start or v_now > v_window_end then
    raise exception 'event check-in window closed';
  end if;

  if exists (
    select 1 from public.event_scans
    where event_id = p_event_id and user_id = p_user_id
  ) then
    raise exception 'duplicate scan';
  end if;

  select p.points_balance, p.disabled_at, e.status
  into v_balance, v_disabled_at, v_status
  from public.profiles p
  join public.employees e on e.employee_id = p.employee_id
  where p.id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'user not found';
  end if;

  if v_disabled_at is not null or v_status <> 'active' then
    raise exception 'account disabled';
  end if;

  insert into public.event_scans (event_id, user_id, scanned_by)
  values (p_event_id, p_user_id, p_scanned_by);

  insert into public.points_transactions (user_id, delta, reason, event_id)
  values (p_user_id, v_points, 'event', p_event_id);

  update public.profiles
  set points_balance = points_balance + v_points
  where id = p_user_id;

  return query select v_balance + v_points, v_points;
end;
$$;

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
  v_disabled_at timestamptz;
  v_status text;
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

  select p.points_balance, p.disabled_at, e.status
  into v_balance, v_disabled_at, v_status
  from public.profiles p
  join public.employees e on e.employee_id = p.employee_id
  where p.id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'user not found';
  end if;

  if v_disabled_at is not null or v_status <> 'active' then
    raise exception 'account disabled';
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

revoke all on function public.grant_event_points(uuid, uuid, uuid) from public;
revoke all on function public.redeem_reward(uuid, uuid, integer) from public;
grant execute on function public.grant_event_points(uuid, uuid, uuid) to service_role;
grant execute on function public.redeem_reward(uuid, uuid, integer) to service_role;
