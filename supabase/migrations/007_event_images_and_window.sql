-- Add optional image for events
alter table public.events
add column if not exists image_url text;

-- Enforce event check-in window: 30 min before start to 1 hour after start
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
begin
  if not exists (
    select 1 from public.profiles
    where id = p_scanned_by and role in ('admin')
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
