/**
 * Deployment configuration flags — not paywalled features. Self-host builds
 * leave these unset and get the original single-deployer behavior; Rodney's
 * hosted instance sets them to turn on billing enforcement and DM quotas.
 */

/** True only when this deployment is Rodney's hosted instance. */
export function isHostedMode(): boolean {
  return process.env.HOSTED_MODE === "true";
}

/**
 * The default per-workspace daily DM cap for hosted mode, read from
 * `DAILY_DM_CAP`. Undefined (no cap) when unset, not a number, or <= 0.
 * Only ever consulted in hosted mode — self-host ignores this entirely.
 */
export function getDefaultDmCap(): number | undefined {
  const raw = process.env.DAILY_DM_CAP;
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function hasRealValue(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  return !/(placeholder|changeme|(^|:\/\/)your[-_ ])/i.test(value);
}

/** True when the three Supabase runtime values needed by the app are present. */
export function isSupabaseConfigured(): boolean {
  return (
    hasRealValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    hasRealValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    hasRealValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/**
 * Public origin used for OAuth callbacks and webhooks.
 *
 * Vercel exposes the production URL automatically, so self-hosters do not
 * need to discover their URL, add another variable, and redeploy a second
 * time. NEXT_PUBLIC_APP_URL remains an explicit custom-domain override.
 */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit && !/(placeholder|changeme|(^|:\/\/)your[-_ ])/i.test(explicit)) {
    return explicit;
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
