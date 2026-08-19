-- Self-host default: a MegaChat instance is single-tenant. The first account
-- to sign up owns it; every signup after that is rejected at the database
-- level. This is the only place registration can actually be stopped --
-- register/page.tsx calls supabase.auth.signUp / signInWithOAuth straight
-- from the browser (email AND OAuth), so an env flag or middleware check
-- can't block it. Hosted deployments flip allow_signups to true once
-- billing is wired (docs: reopen via
-- `update instance_config set allow_signups = true;`).
create table instance_config (
  id int primary key default 1 check (id = 1),
  allow_signups boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into instance_config (id) values (1) on conflict do nothing;

alter table instance_config enable row level security;
-- No policies: this table is service-role only, never read or written from
-- the browser.
revoke all on table instance_config from anon, authenticated;

-- ============================================================
-- SIGNUP GATE
-- ============================================================
-- Signups are allowed when this is the very first user on the instance
-- (bootstrap: someone has to be able to create the first account) or when
-- an operator has explicitly opened the instance up (hosted mode).
create or replace function public.signups_allowed()
returns boolean as $$
  select (select count(*) from auth.users) = 0
    or coalesce((select allow_signups from public.instance_config where id = 1), false);
$$ language sql security definer set search_path = public;

-- Postgres grants EXECUTE on new functions to PUBLIC by default; revoking
-- from anon/authenticated alone does NOT remove that PUBLIC grant, so it
-- must be revoked explicitly too, or any logged-in user could still call
-- this via the PUBLIC role.
revoke execute on function public.signups_allowed() from public, anon, authenticated;
grant execute on function public.signups_allowed() to service_role;

-- BEFORE INSERT so the incoming row isn't counted yet -- the very first
-- signup on a fresh instance always passes. This is deliberately separate
-- from handle_new_user() (00001), which runs AFTER INSERT and swallows all
-- exceptions on its own (raise log + return new); a gate raised from there
-- would never actually block anything.
create or replace function public.gate_signups()
returns trigger as $$
begin
  -- Serializes concurrent signups on this instance so two simultaneous first
  -- signups can't both observe `count(*) = 0` and both pass; the lock is
  -- held for the rest of this transaction and released automatically.
  perform pg_advisory_xact_lock(hashtext('megachat_signup_gate'));
  if not public.signups_allowed() then
    raise exception 'Signups are disabled on this instance';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger gate_signups_before_insert
  before insert on auth.users
  for each row execute function public.gate_signups();

-- Same PUBLIC-grant treatment as signups_allowed() above, for consistency.
-- The trigger itself keeps firing regardless (trigger invocation isn't
-- gated by the inserting role's EXECUTE privilege on the trigger function).
revoke execute on function public.gate_signups() from public, anon, authenticated;
grant execute on function public.gate_signups() to service_role;
