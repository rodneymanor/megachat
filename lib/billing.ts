/**
 * Hosted-mode billing gate. Reads `workspace_billing` (service-role only —
 * see migration 00018) to decide whether a workspace is allowed to run.
 * Self-host deployments never read this table: every function here is a
 * no-op (always "active") when `isHostedMode()` is false.
 *
 * Injected-client style, matching lib/inbox-sync.ts: callers pass the
 * Supabase client to use (service client for server-side call sites), which
 * keeps these functions test-friendly with a fake client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/types/database";
import { isHostedMode, getDefaultDmCap } from "@/lib/config";

/**
 * Whether a workspace is allowed to run flows, send messages, etc.
 * Always true when this deployment is not in hosted mode. In hosted mode,
 * fails closed: a missing row, a query error, or any status other than
 * 'active' (inactive/past_due/cancelled) all mean not active.
 */
export async function isWorkspaceActive(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<boolean> {
  if (!isHostedMode()) return true;

  const { data, error } = await supabase
    .from("workspace_billing")
    .select("status")
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    // PGRST116 = no row (workspace never activated) — expected, not an error
    // worth logging. Anything else is a real query failure; fail closed and
    // log it so it's visible.
    if (error.code !== "PGRST116") {
      console.error(`isWorkspaceActive: query failed for workspace ${workspaceId}`, error);
    }
    return false;
  }

  return data?.status === "active";
}

export interface QuotaContext {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  cap: number;
}

/**
 * The quota context to enforce on outbound sends for a workspace, or
 * undefined when there is nothing to enforce (not hosted, or hosted with no
 * cap configured anywhere). Cap resolution: the workspace's own
 * `dm_daily_cap` override, falling back to the instance-wide `DAILY_DM_CAP`
 * env default. An explicit `dm_daily_cap` of 0 (or negative) is not "no
 * cap" — it means the workspace is blocked, so it still produces a context;
 * `consume_dm_quota` fails closed on cap <= 0. Only a genuinely missing cap
 * (null/undefined from both the row and the env default) means unlimited.
 */
export async function getQuotaContext(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<QuotaContext | undefined> {
  if (!isHostedMode()) return undefined;

  const { data, error } = await supabase
    .from("workspace_billing")
    .select("dm_daily_cap")
    .eq("workspace_id", workspaceId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(`getQuotaContext: query failed for workspace ${workspaceId}`, error);
  }

  const cap = data?.dm_daily_cap ?? getDefaultDmCap();
  // Only a missing cap means unlimited. An explicit 0 (or negative) must
  // flow through so the RPC blocks every send, not be mistaken for "no cap".
  if (cap == null) return undefined;

  return { supabase, workspaceId, cap };
}

/**
 * API defense-in-depth for mutating app/api/v1/** routes: returns a 402 JSON
 * response when the workspace is not active (hosted mode only — always null
 * on self-host), or null to let the route proceed. Callers pass the service
 * client; workspace_billing is service-role only.
 */
export async function requireActiveWorkspace(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<Response | null> {
  if (await isWorkspaceActive(supabase, workspaceId)) return null;

  return NextResponse.json({ error: "Workspace not active" }, { status: 402 });
}
