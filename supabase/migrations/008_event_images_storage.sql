-- Storage bucket for event images (public read)
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- Allow public read of event images
drop policy if exists "Event images read" on storage.objects;
create policy "Event images read" on storage.objects
for select
using (bucket_id = 'event-images');

-- Allow admins to upload/update/delete event images
drop policy if exists "Event images insert admin" on storage.objects;
create policy "Event images insert admin" on storage.objects
for insert
with check (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "Event images update admin" on storage.objects;
create policy "Event images update admin" on storage.objects
for update
using (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "Event images delete admin" on storage.objects;
create policy "Event images delete admin" on storage.objects
for delete
using (bucket_id = 'event-images' and public.is_admin());
