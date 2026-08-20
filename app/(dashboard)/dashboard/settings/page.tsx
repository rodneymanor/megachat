import { getWorkspace } from "@/lib/workspace";
import { isHostedMode } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkspaceSecretStatus } from "@/lib/secrets";
import { normalizeGlobalKeywords } from "@/lib/global-keywords";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const { workspace } = await getWorkspace();

  // Secret columns (late_api_key_encrypted, ai_api_key) are no longer
  // readable via the cookie client's `workspaces(*)` join (migration
  // 00020) — status is derived through the service client instead.
  const serviceClient = await createServiceClient();
  const { hasZernioKey, hasAiKey } = await getWorkspaceSecretStatus(
    serviceClient,
    workspace.id
  );

  return (
    <SettingsView
      workspace={{
        id: workspace.id,
        name: workspace.name,
        hasApiKey: hasZernioKey,
        hasAiKey,
        globalKeywords: normalizeGlobalKeywords(workspace.global_keywords),
        hostedMode: isHostedMode(),
      }}
    />
  );
}
