import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isHostedMode } from "@/lib/config";
import { isWorkspaceActive } from "@/lib/billing";
import type { Database } from "@/lib/types/database";

export const WORKSPACE_COOKIE = "megachat_workspace_id";

// Migration 00020 revoked column-less `workspaces(*)` embeds for
// anon/authenticated — only these columns are grant-readable from the
// browser. Secret columns (late_api_key_encrypted, ai_api_key,
// webhook_secret) are deliberately excluded; use lib/secrets.ts for those
// via the service client instead.
const SAFE_WORKSPACE_COLUMNS =
  "id, name, slug, ai_provider, global_keywords, onboarding_completed_at, created_at, updated_at" as const;

type WorkspaceRow = Pick<
  Database["public"]["Tables"]["workspaces"]["Row"],
  | "id"
  | "name"
  | "slug"
  | "ai_provider"
  | "global_keywords"
  | "onboarding_completed_at"
  | "created_at"
  | "updated_at"
>;

/**
 * Cached per-request: deduplicates across layout + page in the same render.
 * Reads workspace ID from cookie if set; falls back to first workspace.
 */
export const getWorkspace = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  let resolved: { workspace: WorkspaceRow; role: string } | undefined;

  // Try cookie workspace first
  if (selectedId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select(`workspace_id, role, workspaces(${SAFE_WORKSPACE_COLUMNS})`)
      .eq("user_id", user.id)
      .eq("workspace_id", selectedId)
      .single();

    if (membership?.workspaces) {
      resolved = { workspace: membership.workspaces, role: membership.role };
    }
  }

  // Fallback to first workspace
  if (!resolved) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select(`workspace_id, role, workspaces(${SAFE_WORKSPACE_COLUMNS})`)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership?.workspaces) redirect("/login");
    resolved = { workspace: membership.workspaces, role: membership.role };
  }

  // Hosted-mode paid-activation gate. workspace_billing is service-role
  // only (RLS revoked from anon/authenticated), so the lookup needs the
  // service client even though `supabase` above is the cookie client.
  if (isHostedMode()) {
    const serviceClient = await createServiceClient();
    if (!(await isWorkspaceActive(serviceClient, resolved.workspace.id))) {
      redirect("/locked");
    }
  }

  return {
    user,
    workspace: resolved.workspace,
    role: resolved.role,
    supabase,
  };
});
