/**
 * The platforms MegaChat can drive. Zernio itself connects many more
 * (Facebook, WhatsApp, Twitter, Telegram, Bluesky, Reddit, TikTok, YouTube,
 * LinkedIn, ads accounts...), but this build only offers the Instagram
 * comment-to-DM flow, so account sync and the channel picker skip the rest.
 */
export const PLATFORMS = ["instagram"] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
};

export function isSupportedPlatform(value: unknown): value is Platform {
  return (
    typeof value === "string" && (PLATFORMS as readonly string[]).includes(value)
  );
}

export function platformLabel(platform: string): string {
  return isSupportedPlatform(platform)
    ? PLATFORM_LABELS[platform]
    : platform.charAt(0).toUpperCase() + platform.slice(1);
}
