-- Allow visitors and authenticated users to upload receipt files.
drop policy if exists "Allow receipt uploads" on storage.objects;

create policy "Allow receipt uploads"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = 'receipts'
);

-- Allow Staff and Admin users to view receipt files.
drop policy if exists "Staff and Admin can read receipts" on storage.objects;

create policy "Staff and Admin can read receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and public.current_user_role() in ('STAFF', 'ADMIN')
);