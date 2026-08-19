import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import {
  ensureWebhookRegistered,
  getOrCreateWorkspaceWebhookSecret,
} from "@/lib/zernio-webhook";
import { backfillInboxConversations } from "@/lib/inbox-sync";
import { isSupportedPlatform } from "@/lib/platforms";
import { requireActiveWorkspace } from "@/lib/billing";
import { encryptSecret } from "@/lib/crypto";

/**
 * POST /api/v1/channels/test-key
 *
 * Tests a Zernio API key, saves it to the workspace, and auto-syncs channels.
 *
 * Requires an authenticated user (this was previously an unauthenticated
 * "is this Zernio key valid?" oracle). When workspaceId is provided, the
 * caller must also be a member of that workspace, and every workspace write
 * (key save, webhook-secret get-or-create, channel sync side effects) goes
 * through the service client — the cookie client no longer has column
 * access to late_api_key_encrypted / webhook_secret (migration 00020).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { apiKey, workspaceId } = body;

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json(
      { error: "apiKey is required" },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  // If workspaceId provided, the caller must be a member of it. RLS on
  // workspace_members makes this query itself safe to run with the cookie
  // client.
  if (workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const billingBlock = await requireActiveWorkspace(serviceClient, workspaceId);
    if (billingBlock) return billingBlock;
  }

  // Validate the key by listing accounts
  let accounts: Array<{ _id?: string; platform?: string; username?: string; displayName?: string; profilePicture?: string }>;
  try {
    const zernio = createZernioClient(apiKey.trim());
    const res = await zernio.accounts.listAccounts();
    accounts = (res.data?.accounts ?? []) as typeof accounts;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid API key or connection error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // If workspaceId provided, save the key and sync channels
  if (workspaceId) {
    // Save the API key (service client — secret column is not writable
    // through the cookie client)
    const { error: saveErr } = await serviceClient
      .from("workspaces")
      .update({ late_api_key_encrypted: encryptSecret(apiKey.trim()) })
      .eq("id", workspaceId)
      .select("id")
      .single();

    if (saveErr) {
      return NextResponse.json(
        { error: `Key valid but failed to save: ${saveErr.message}` },
        { status: 500 }
      );
    }

    // Register (or refresh) this deployment's webhook in Zernio so inbound
    // messages/comments reach the Inbox. Best-effort: a failure here must not
    // block saving the key or syncing channels.
    try {
      const secret = await getOrCreateWorkspaceWebhookSecret(serviceClient, workspaceId);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const zernio = createZernioClient(apiKey.trim());
      await ensureWebhookRegistered(zernio, {
        appUrl,
        secret,
        events: ["message.received", "comment.received"],
      });
    } catch (err) {
      console.error("[test-key] webhook auto-registration failed:", err);
    }

    // Auto-sync channels (service client — channels are workspace-scoped,
    // not gated by the secret-column grants, but kept consistent with the
    // rest of this route's writes)
    const { data: existingChannels } = await serviceClient
      .from("channels")
      .select("*")
      .eq("workspace_id", workspaceId);

    const existingByLateId = new Map(
      (existingChannels ?? []).map((c) => [c.late_account_id, c])
    );

    for (const account of accounts) {
      if (!account._id) continue;
      if (existingByLateId.has(account._id)) continue;
      if (!isSupportedPlatform(account.platform)) continue;

      const { error: insertErr } = await serviceClient.from("channels").insert({
        workspace_id: workspaceId,
        platform: account.platform,
        late_account_id: account._id,
        username: account.username || null,
        display_name: account.displayName || account.username || null,
        profile_picture: account.profilePicture || null,
        is_active: true,
      });
      if (insertErr) {
        console.error("[test-key] channel insert failed:", insertErr);
      }
    }

    // Backfill conversations that predate webhook registration so a
    // first-time API-key setup fills the Inbox immediately (best-effort).
    try {
      const { data: activeChannels } = await serviceClient
        .from("channels")
        .select("id, late_account_id, platform")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      await backfillInboxConversations({
        supabase: serviceClient,
        zernio: createZernioClient(apiKey.trim()),
        workspaceId,
        channels: activeChannels ?? [],
      });
    } catch (err) {
      console.error("[test-key] inbox backfill failed:", err);
    }
  }

  return NextResponse.json({ accounts });
}
