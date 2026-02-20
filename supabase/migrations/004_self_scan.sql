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

  return query select v_balance + v_points;
end;
$$;

revoke all on function public.grant_event_points(uuid, uuid, uuid) from public;
grant execute on function public.grant_event_points(uuid, uuid, uuid) to service_role;
