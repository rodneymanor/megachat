import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { PLATFORMS, isSupportedPlatform } from "@/lib/platforms";
import { requireActiveWorkspace } from "@/lib/billing";
import { getWorkspaceZernioKey } from "@/lib/secrets";
import { getPublicAppUrl } from "@/lib/config";

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
 * POST /api/v1/channels/connect
 *
 * Returns Zernio's OAuth/connect URL for the given platform.
 * Zernio handles the entire connection flow (OAuth, page selection, etc.)
 * and redirects back to our callback URL when done.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = await createServiceClient();

  const billingBlock = await requireActiveWorkspace(serviceClient, workspace.id);
  if (billingBlock) return billingBlock;

  const zernioKey = await getWorkspaceZernioKey(serviceClient, workspace.id);
  if (!zernioKey) {
    return NextResponse.json(
      { error: "Zernio API key not configured. Go to Settings first." },
      { status: 400 }
    );
  }

  const { platform } = await request.json();

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json(
      { error: `Unsupported platform. Must be one of: ${PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  const zernio = createZernioClient(zernioKey);

  try {
    // Get profile ID (required by Zernio's connect endpoint)
    const profilesRes = await zernio.profiles.listProfiles();
    const profiles = profilesRes.data?.profiles ?? [];
    if (profiles.length === 0) {
      return NextResponse.json(
        { error: "No Zernio profiles found. Create one in your Zernio dashboard first." },
        { status: 400 }
      );
    }

    const profileId = profiles[0]._id!;
    const appUrl = getPublicAppUrl();
    const callbackUrl = `${appUrl}/dashboard/channels/callback`;

    // Zernio handles everything: OAuth, page selection, Bluesky credentials, Telegram code
    const res = await zernio.connect.getConnectUrl({
      path: { platform },
      query: { profileId, redirect_url: callbackUrl },
    });

    if (!res.data?.authUrl) {
      return NextResponse.json({ error: "Failed to get connect URL" }, { status: 500 });
    }

    return NextResponse.json({ authUrl: res.data.authUrl });
  } catch (error) {
    console.error("Failed to get connect URL:", error);
    return NextResponse.json(
      { error: `Connection failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
