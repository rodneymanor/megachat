import { getWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkspaceSecretStatus } from "@/lib/secrets";
import { normalizeGlobalKeywords } from "@/lib/global-keywords";
import { isHostedMode } from "@/lib/config";
import { Sidebar } from "@/components/sidebar";
import { OnboardingDialog } from "@/components/onboarding-dialog";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id);

  const workspaces = (memberships ?? [])
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string }),
      role: m.role,
    }))
    .filter((w) => w.id);

  // First-run setup. Key status has to come from the service client — the
  // secret columns are not readable by the cookie client (migration 00020).
  const needsOnboarding = !workspace.onboarding_completed_at;
  const secretStatus = needsOnboarding
    ? await getWorkspaceSecretStatus(await createServiceClient(), workspace.id)
    : null;

  return (
    <div className="flex h-screen">
      <Sidebar workspace={workspace} user={user} workspaces={workspaces} />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {secretStatus && (
        <OnboardingDialog
          workspaceId={workspace.id}
          hasZernioKey={secretStatus.hasZernioKey}
          hasAiKey={secretStatus.hasAiKey}
          globalKeywords={normalizeGlobalKeywords(workspace.global_keywords)}
          hostedMode={isHostedMode()}
        />
      )}
    </div>
  );
}
