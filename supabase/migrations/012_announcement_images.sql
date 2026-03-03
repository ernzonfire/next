-- Optional image attachment for announcements
alter table public.announcements
add column if not exists image_url text;

-- Public bucket for announcement images
insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

-- Public read access
drop policy if exists "Announcement images read" on storage.objects;
create policy "Announcement images read" on storage.objects
for select
using (bucket_id = 'announcement-images');

-- Admin write access
drop policy if exists "Announcement images insert admin" on storage.objects;
create policy "Announcement images insert admin" on storage.objects
for insert
with check (bucket_id = 'announcement-images' and public.is_admin());

drop policy if exists "Announcement images update admin" on storage.objects;
create policy "Announcement images update admin" on storage.objects
for update
using (bucket_id = 'announcement-images' and public.is_admin());

drop policy if exists "Announcement images delete admin" on storage.objects;
create policy "Announcement images delete admin" on storage.objects
for delete
using (bucket_id = 'announcement-images' and public.is_admin());
