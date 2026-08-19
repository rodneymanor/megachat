-- Per-workspace, per-UTC-day DM counter for the hosted daily send cap.
-- Service-role only -- members never read or write this directly; it's
-- maintained solely through consume_dm_quota() below.
create table workspace_usage (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  day date not null,
  dm_count int not null default 0,
  primary key (workspace_id, day)
);

alter table workspace_usage enable row level security;
revoke all on table workspace_usage from anon, authenticated;

-- ============================================================
-- CONSUME DM QUOTA
-- ============================================================
-- Atomically increments today's send counter for a workspace and reports
-- whether the send is allowed, in a single statement so there's no
-- check-then-increment race between concurrent sends. On a fresh row the
-- insert itself is the "consume" (cap >= 1 is guaranteed by the guard
-- below, so starting at dm_count = 1 is always valid); on an existing row
-- the on-conflict update only applies -- and therefore only counts as
-- FOUND -- while the current count is still under the cap.
--
-- cap <= 0 or null is a defensive fail-closed guard, not the "no cap"
-- path: callers resolve an actual cap (workspace_billing.dm_daily_cap or
-- DAILY_DM_CAP) before calling this at all, and skip calling it entirely
-- when no cap applies. If this function is ever invoked without a usable
-- cap, refuse the send rather than silently allowing unlimited sends.
create or replace function public.consume_dm_quota(ws_id uuid, cap int)
returns boolean as $$
begin
  if cap is null or cap <= 0 then
    return false;
  end if;

  insert into workspace_usage (workspace_id, day, dm_count)
  values (ws_id, (now() at time zone 'utc')::date, 1)
  on conflict (workspace_id, day) do update
    set dm_count = workspace_usage.dm_count + 1
    where workspace_usage.dm_count < cap;

  return found;
end;
$$ language plpgsql security definer set search_path = public;

-- Postgres grants EXECUTE on new functions to PUBLIC by default; revoking
-- from anon/authenticated alone does NOT remove that PUBLIC grant. Without
-- this, any logged-in user could call rpc("consume_dm_quota", { ws_id: X,
-- cap: 1 }) via the PUBLIC role and burn another workspace's daily quota.
revoke execute on function public.consume_dm_quota(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_dm_quota(uuid, int) to service_role;
