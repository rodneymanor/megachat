-- ============================================================
-- MIGRATION 21: WORKSPACE ONBOARDING
-- ============================================================
-- New workspaces land on /dashboard/flows with no Zernio API key, no AI
-- Gateway key, and no global keywords -- every one of which has to be
-- configured before a flow can do anything. The dashboard now shows a
-- guided onboarding dialog until that work is acknowledged, and this
-- column is what remembers "acknowledged".
--
-- Deliberately a timestamp rather than a boolean: it doubles as a record of
-- when the workspace was walked through setup, and `null` (never onboarded)
-- is the only state the dialog keys off.
--
-- The dialog writes this from the browser alongside `global_keywords`, so
-- the column needs the same treatment as the other non-secret settings
-- columns from migration 00020: an explicit select + update grant for
-- `authenticated`. Table-level grants were revoked there, so a new column
-- is invisible to the cookie client until it is named here.

alter table workspaces
  add column if not exists onboarding_completed_at timestamptz;

grant select (onboarding_completed_at) on workspaces to authenticated;
grant update (onboarding_completed_at) on workspaces to authenticated;

notify pgrst, 'reload schema';
