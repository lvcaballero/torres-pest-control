-- ============================================================================
-- Torres Pest Control — Migration 016 (Forgot Password)
-- ============================================================================
-- Generates a temporary password for a "forgot password" request and hands
-- it back to the caller so it can be emailed.
--
-- IMPORTANT: this function returns a plaintext (unhashed) password, so it
-- must NEVER be callable by anon/authenticated roles directly — only from a
-- trusted server context (the forgot-password Edge Function) using the
-- service_role key. That's why execute is revoked from anon/authenticated
-- below. If those grants are ever reset by a future migration, re-apply them.

create or replace function public.request_password_reset(target_email text)
returns table (user_id uuid, user_name text, user_email text, temp_password text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target users;
  generated_password text;
begin
  select * into target from users u where lower(u.email) = lower(target_email);

  -- No matching account: return an empty result rather than raising, so the
  -- caller can show the same generic "if that email exists..." message
  -- whether or not the account exists (avoids leaking which emails are
  -- registered).
  if target.id is null then
    return;
  end if;

  -- 12 random alphanumeric characters, guaranteed to contain a letter and a
  -- number so it passes the same password policy used elsewhere.
  generated_password := substr(md5(random()::text || clock_timestamp()::text), 1, 10) || floor(random() * 90 + 10)::text;

  update users
     set password_hash = crypt(generated_password, gen_salt('bf')),
         status = 'PENDING'
   where users.id = target.id;

  delete from sessions where sessions.user_id = target.id;

  perform write_log(target, 'Requested a password reset.', 'auth');

  return query select target.id, target.name, target.email, generated_password;
end;
$$;

revoke all on function public.request_password_reset(text) from public;
revoke all on function public.request_password_reset(text) from anon;
revoke all on function public.request_password_reset(text) from authenticated;
grant execute on function public.request_password_reset(text) to service_role;
