import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { requireActiveWorkspace } from "@/lib/billing";
import { getWorkspaceZernioKey } from "@/lib/secrets";

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Migration 00020 revoked `workspaces(*)` for anon/authenticated — select
  // only the grant-readable columns needed here. late_api_key_encrypted is
  // fetched separately via lib/secrets.ts with the service client.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) return null;
  return membership.workspaces;
}

/**
 * DELETE /api/v1/channels/[channelId]
 *
 * Permanently deletes a channel: disconnects the account on Zernio first
 * (otherwise /api/v1/channels/sync would re-create it from listAccounts),
 * then deletes the local row (cascades conversations, contact links, etc.).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = await createServiceClient();

  const billingBlock = await requireActiveWorkspace(serviceClient, workspace.id);
  if (billingBlock) return billingBlock;

  const { data: channel } = await supabase
    .from("channels")
    .select("id, late_account_id")
    .eq("id", channelId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!channel)
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  const zernioKey = await getWorkspaceZernioKey(serviceClient, workspace.id);
  if (zernioKey) {
    const zernio = createZernioClient(zernioKey);
    try {
      const res = await zernio.accounts.deleteAccount({
        path: { accountId: channel.late_account_id },
      });
      // A 404 means the account is already gone from Zernio; that's fine.
      if (res.error && res.response?.status !== 404) {
        return NextResponse.json(
          { error: `Failed to disconnect on Zernio: ${JSON.stringify(res.error)}` },
          { status: 502 }
        );
      }
    } catch (error) {
      console.error("Failed to disconnect Zernio account:", error);
      return NextResponse.json(
        { error: `Failed to disconnect on Zernio: ${error instanceof Error ? error.message : String(error)}` },
        { status: 502 }
      );
    }
  }

  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", channelId)
    .eq("workspace_id", workspace.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
