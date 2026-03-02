-- Backfill missing event image support for environments where
-- migration history was repaired but 007/008 SQL did not run.

alter table public.events
add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

drop policy if exists "Event images read" on storage.objects;
create policy "Event images read" on storage.objects
for select
using (bucket_id = 'event-images');

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
