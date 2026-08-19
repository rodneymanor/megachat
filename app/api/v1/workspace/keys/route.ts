import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

/**
 * POST /api/v1/workspace/keys
 *
 * The only path allowed to write `workspaces.late_api_key_encrypted` /
 * `workspaces.ai_api_key` — migration 00020 revoked browser access to those
 * columns entirely. Authenticates via the cookie client, verifies the
 * caller is a member of the target workspace (RLS on workspace_members
 * makes that query itself safe to run with the cookie client), then writes
 * with the service client.
 *
 * No billing/402 gate here on purpose: setting keys is how a workspace gets
 * activated in the first place, so it must not be blocked by the billing
 * gate that keys themselves help satisfy.
 *
 * Body: { workspaceId: string, zernioKey?: string, aiKey?: string }
 * An empty string for either key clears it (sets to null); omit the field
 * to leave that key untouched.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { workspaceId, zernioKey, aiKey } = body ?? {};

  if (!workspaceId || typeof workspaceId !== "string") {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const hasZernioKey = typeof zernioKey === "string";
  const hasAiKey = typeof aiKey === "string";
  if (!hasZernioKey && !hasAiKey) {
    return NextResponse.json(
      { error: "At least one of zernioKey or aiKey is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, string | null> = {};
  if (hasZernioKey) {
    update.late_api_key_encrypted = zernioKey.trim() ? encryptSecret(zernioKey.trim()) : null;
  }
  if (hasAiKey) {
    update.ai_api_key = aiKey.trim() ? encryptSecret(aiKey.trim()) : null;
  }

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("workspaces")
    .update(update)
    .eq("id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
