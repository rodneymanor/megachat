/**
 * Service-client helpers for reading workspace secret columns
 * (`late_api_key_encrypted`, `ai_api_key`). Migration 00020 revokes browser
 * (anon/authenticated) access to these columns entirely, so any caller that
 * needs the raw key value MUST go through here with the service client —
 * never `.from("workspaces").select(...)` with the cookie client.
 *
 * Injected-client style, matching lib/billing.ts: callers pass the Supabase
 * client to use (always the service client for these calls), which keeps
 * these functions test-friendly with a fake client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { tryDecryptSecret } from "@/lib/crypto";

/**
 * The workspace's Zernio API key, or null if unset, the row is missing, or
 * the stored value fails to decrypt (e.g. `ENCRYPTION_KEY` was rotated) —
 * callers treat that the same as "no key configured" rather than throwing.
 */
export async function getWorkspaceZernioKey(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", workspaceId)
    .single();

  if (error) return null;
  return tryDecryptSecret(data?.late_api_key_encrypted ?? null);
}

/**
 * The workspace's AI Gateway key, or null if unset, the row is missing, or
 * the stored value fails to decrypt (e.g. `ENCRYPTION_KEY` was rotated) —
 * callers treat that the same as "no key configured" rather than throwing.
 */
export async function getWorkspaceAiKey(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("ai_api_key")
    .eq("id", workspaceId)
    .single();

  if (error) return null;
  return tryDecryptSecret(data?.ai_api_key ?? null);
}

/**
 * Whether each secret is configured, without ever returning the value —
 * for UI badges like Settings' "API key configured" / "AI Gateway key
 * configured" that used to be derived from a `workspaces(*)` row fetched
 * with the cookie client.
 */
export async function getWorkspaceSecretStatus(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<{ hasZernioKey: boolean; hasAiKey: boolean }> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted, ai_api_key")
    .eq("id", workspaceId)
    .single();

  if (error || !data) return { hasZernioKey: false, hasAiKey: false };

  return {
    hasZernioKey: !!data.late_api_key_encrypted,
    hasAiKey: !!data.ai_api_key,
  };
}
