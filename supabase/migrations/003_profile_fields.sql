-- Add extended employee profile fields
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists job_title text,
  add column if not exists campaign text,
  add column if not exists site text,
  add column if not exists work_arrangement text,
  add column if not exists dob_text text;

-- Update trigger function to capture extended metadata
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
begin
  v_employee_id := coalesce(
    new.raw_user_meta_data->>'employee_id',
    case
      when new.email ilike '%@next.local'
        and split_part(new.email, '@', 1) ~ '^[0-9]{5,7}$'
      then split_part(new.email, '@', 1)
      else null
    end
  );

  v_first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  v_full_name := nullif(new.raw_user_meta_data->>'full_name', '');

  if v_full_name is null then
    v_full_name := trim(concat_ws(' ', v_first_name, v_last_name));
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    employee_id,
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
    coalesce(v_full_name, ''),
    coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'user'::public.app_role),
    v_employee_id,
    v_first_name,
    v_last_name,
    nullif(new.raw_user_meta_data->>'job_title', ''),
    nullif(new.raw_user_meta_data->>'campaign', ''),
    nullif(new.raw_user_meta_data->>'site', ''),
    nullif(new.raw_user_meta_data->>'work_arrangement', ''),
    nullif(new.raw_user_meta_data->>'dob_text', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
