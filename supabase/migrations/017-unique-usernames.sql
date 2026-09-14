-- ============================================================================
-- Torres Pest Control — Migration 017 (Unique Usernames)
-- ============================================================================
-- Usernames are shared by every role because all accounts live in
-- public.users. Enforce that rule in the database as well as in the form so
-- concurrent account creation and direct RPC calls cannot create duplicates.

do $$
begin
  if exists (
    select 1
    from public.users
    group by lower(btrim(username))
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce unique usernames: duplicate usernames already exist. Rename the duplicates before rerunning this migration.';
  end if;
end;
$$;

-- `btrim` keeps "alex", " Alex ", and "ALEX" from becoming distinct login
-- identities. The index is the authoritative safeguard for every role.
create unique index if not exists users_username_normalized_unique_idx
  on public.users (lower(btrim(username)));

notify pgrst, 'reload schema';
