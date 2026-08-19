-- Hosted-mode paid-activation state, keyed to a workspace. Kept out of the
-- workspaces table (and out of RLS entirely) because workspaces UPDATE is
-- member-writable from the browser today -- billing status must not be
-- something a member can flip themselves. Written by a future Stripe
-- webhook and, until then, scripts/activate-workspace.mjs -- both
-- service-role only. Self-host builds never read this table (isWorkspaceActive
-- is always true when not in hosted mode).
create table workspace_billing (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'past_due', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  dm_daily_cap int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on workspace_billing for each row execute function update_updated_at();

alter table workspace_billing enable row level security;
-- No policies: service-role only, same reasoning as instance_config (00017).
revoke all on table workspace_billing from anon, authenticated;
