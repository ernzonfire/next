-- Remove vp_admin role and normalize to admin

-- Update existing roles in profiles and auth users
update public.profiles
set role = 'admin'
where role = 'vp_admin';

update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"',
  true
)
where raw_app_meta_data->>'role' = 'vp_admin';

-- Replace enum without vp_admin
DO $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role_new') then
    create type public.app_role_new as enum ('admin', 'user');
  end if;
end $$;

alter table public.profiles
  alter column role type public.app_role_new
  using (case when role::text = 'vp_admin' then 'admin' else role::text end)::public.app_role_new;

DO $$
begin
  if exists (select 1 from pg_type where typname = 'app_role') then
    drop type public.app_role;
  end if;
end $$;

alter type public.app_role_new rename to app_role;

-- Policies updates (drop old vp_admin rules)
drop policy if exists "Announcements: update own or vp" on public.announcements;
drop policy if exists "Announcements: delete own or vp" on public.announcements;

create policy "Announcements: update by admin"
  on public.announcements for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Announcements: delete by admin"
  on public.announcements for delete
  using (public.is_admin());

-- Update role helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;

drop function if exists public.is_vp_admin();

-- Update profile guard
create or replace function public.restrict_profile_updates()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'service_role' then
    if new.points_balance <> old.points_balance then
      raise exception 'points_balance is server-managed';
    end if;
  end if;

  if new.role <> old.role and current_user <> 'service_role' then
    if not public.is_admin() then
      raise exception 'role changes require admin';
    end if;
  end if;

  return new;
end;
$$;

-- Update grant_event_points to remove vp_admin
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
begin
  if not exists (
    select 1 from public.profiles
    where id = p_scanned_by and role in ('admin')
  ) and p_scanned_by <> p_user_id then
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

  return query select v_balance + v_points, v_points;
end;
$$;

revoke all on function public.grant_event_points(uuid, uuid, uuid) from public;
grant execute on function public.grant_event_points(uuid, uuid, uuid) to service_role;
