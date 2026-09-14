-- Migration 013 — Shared user profile pictures
-- Run after schema-v2.sql and the migrations used by the current app.

alter table public.users
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile avatars readable" on storage.objects;
create policy "Profile avatars readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-avatars');

drop policy if exists "Profile avatars uploadable" on storage.objects;
create policy "Profile avatars uploadable" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'profile-avatars');

drop policy if exists "Profile avatars replaceable" on storage.objects;
create policy "Profile avatars replaceable" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'profile-avatars')
  with check (bucket_id = 'profile-avatars');

drop function if exists public.update_user_avatar(uuid, uuid, text);
create or replace function public.update_user_avatar(
  session_token uuid,
  target_id uuid,
  new_avatar_url text
)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  caller users;
  updated users;
begin
  caller := public.get_session_user(session_token);
  if caller.id is null then raise exception 'Not signed in.'; end if;

  if caller.id <> target_id then
    raise exception 'You can only update your own profile picture.';
  end if;

  update public.users
     set avatar_url = nullif(new_avatar_url, '')
   where id = target_id
   returning * into updated;

  if updated.id is null then raise exception 'Account not found.'; end if;
  return updated;
end;
$$;

grant execute on function public.update_user_avatar(uuid, uuid, text) to anon, authenticated;
notify pgrst, 'reload schema';
