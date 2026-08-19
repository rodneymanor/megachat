-- ============================================================
-- MIGRATION 20: WORKSPACES COLUMN PRIVILEGES
-- ============================================================
-- `workspaces` holds three secret columns alongside ordinary settings:
-- `late_api_key_encrypted` (Zernio API key), `ai_api_key` (AI Gateway key),
-- and `webhook_secret` (HMAC secret for verifying inbound webhooks). RLS on
-- this table is row-level only (any workspace member can select/update any
-- row they belong to) with no column restriction, so every member's browser
-- session -- via the anon/authenticated Postgres role used by the cookie
-- client -- can read and overwrite all three secrets directly through
-- PostgREST. That's the vulnerability this migration closes.
--
-- Fix: revoke table-level select/insert/update from anon/authenticated
-- entirely, then re-grant only on the specific columns the app legitimately
-- reads/writes from the browser. Secret columns are simply never listed in
-- any grant, so they disappear from PostgREST's schema cache for these
-- roles -- `select *` and `workspaces(*)` embeds now error for anon/
-- authenticated instead of leaking the columns.
--
-- service_role is completely unaffected: it bypasses grants (and RLS) the
-- same way it already bypasses RLS elsewhere in this schema, so all
-- server-side reads/writes of the secret columns (lib/secrets.ts, the flow
-- engine, comment processor, webhook route, cron) continue to work via the
-- service client.
--
-- Column-level grants layer on top of the existing row-level policies from
-- 00002 (select/update gated by is_workspace_member); a member still only
-- sees/updates rows for workspaces they belong to, now restricted to a
-- safe column subset.

revoke select, insert, update on table workspaces from anon, authenticated;

-- Safe to read from the browser: no secrets.
grant select (
  id,
  name,
  slug,
  ai_provider,
  global_keywords,
  created_at,
  updated_at
) on workspaces to authenticated;

-- Safe to write from the browser: workspace name and global keyword rules.
-- Key fields (late_api_key_encrypted, ai_api_key) and webhook_secret must go
-- through server-side routes using the service client (see
-- app/api/v1/workspace/keys/route.ts and lib/secrets.ts).
grant update (name, global_keywords) on workspaces to authenticated;

-- Workspace creation only ever sets name + slug; every other column is
-- server-defaulted or set later via the key-write route. (Note: there is
-- still no INSERT RLS policy on workspaces, so `createWorkspace` in
-- lib/actions/workspace.ts remains blocked regardless -- a known,
-- deliberately deferred issue, not something this migration needs to fix.)
grant insert (name, slug) on workspaces to authenticated;

-- anon (logged-out) never needs any access to workspaces.

notify pgrst, 'reload schema';
