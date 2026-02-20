-- Add employee_id support (nullable for existing accounts)
alter table public.profiles
  add column if not exists employee_id text;

-- Populate employee_id from next.local email local-part when possible
update public.profiles p
set employee_id = split_part(u.email, '@', 1)
from auth.users u
where p.id = u.id
  and p.employee_id is null
  and u.email ilike '%@next.local'
  and split_part(u.email, '@', 1) ~ '^[0-9]{5,7}$';

-- Enforce format: 5-7 digits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_employee_id_format'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_employee_id_format
      CHECK (employee_id is null OR employee_id ~ '^[0-9]{5,7}$');
  END IF;
END $$;

-- Unique employee_id when set
create unique index if not exists profiles_employee_id_unique
  on public.profiles (employee_id)
  where employee_id is not null;

-- Update trigger function to capture employee_id on user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'user'::public.app_role),
    coalesce(
      new.raw_user_meta_data->>'employee_id',
      case
        when new.email ilike '%@next.local'
          and split_part(new.email, '@', 1) ~ '^[0-9]{5,7}$'
        then split_part(new.email, '@', 1)
        else null
      end
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
