-- Optional image attachment for rewards
alter table public.rewards
add column if not exists image_url text;

-- Public bucket for reward images
insert into storage.buckets (id, name, public)
values ('reward-images', 'reward-images', true)
on conflict (id) do nothing;

-- Public read access
drop policy if exists "Reward images read" on storage.objects;
create policy "Reward images read" on storage.objects
for select
using (bucket_id = 'reward-images');

-- Admin write access
drop policy if exists "Reward images insert admin" on storage.objects;
create policy "Reward images insert admin" on storage.objects
for insert
with check (bucket_id = 'reward-images' and public.is_admin());

drop policy if exists "Reward images update admin" on storage.objects;
create policy "Reward images update admin" on storage.objects
for update
using (bucket_id = 'reward-images' and public.is_admin());

drop policy if exists "Reward images delete admin" on storage.objects;
create policy "Reward images delete admin" on storage.objects
for delete
using (bucket_id = 'reward-images' and public.is_admin());
