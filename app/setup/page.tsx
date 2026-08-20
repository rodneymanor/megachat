import type { Metadata } from "next";
import { getPublicAppUrl, isHostedMode, isSupabaseConfigured } from "@/lib/config";
import SetupWizard from "./setup-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your deployment",
  description: "Connect Supabase and finish a self-hosted MegaChat deployment.",
};

export default function SetupPage() {
  return (
    <SetupWizard
      configured={isSupabaseConfigured()}
      hostedMode={isHostedMode()}
      publicAppUrl={getPublicAppUrl()}
    />
  );
}
