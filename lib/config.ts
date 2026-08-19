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
