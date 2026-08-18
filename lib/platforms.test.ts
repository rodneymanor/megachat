import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PLATFORMS, PLATFORM_LABELS, isSupportedPlatform, platformLabel } from "./platforms";

/**
 * Issue #16: the channel picker offered WhatsApp, the connect route rejected it
 * and the channels check constraint could not have stored it anyway. Each layer
 * carried its own copy of the list. These tests pin them to PLATFORMS.
 *
 * This build (the Instagram comment-to-DM core) intentionally narrows
 * PLATFORMS to Instagram only, even though the channels table's check
 * constraint still allows the platforms the full MegaChat schema supports
 * (harmless unused columns/values). So PLATFORMS only needs to be a *subset*
 * of what the DB will accept, not an exact match.
 */
describe("platform allowlist", () => {
  it("labels every supported platform", () => {
    for (const platform of PLATFORMS) {
      expect(PLATFORM_LABELS[platform]).toBeTruthy();
    }
  });

  it("accepts supported platforms and rejects everything else", () => {
    expect(isSupportedPlatform("instagram")).toBe(true);
    // This build only drives Instagram; Zernio connects the rest but there's
    // no UI or inbox for them here.
    expect(isSupportedPlatform("whatsapp")).toBe(false);
    expect(isSupportedPlatform("tiktok")).toBe(false);
    expect(isSupportedPlatform("youtube")).toBe(false);
    expect(isSupportedPlatform(undefined)).toBe(false);
  });

  it("falls back to a capitalised name for unknown platforms", () => {
    expect(platformLabel("whatsapp")).toBe("Whatsapp");
    expect(platformLabel("tiktok")).toBe("Tiktok");
  });

  it("every supported platform is allowed by the channels check constraint", () => {
    const allowed = latestChannelsPlatformConstraint();
    for (const platform of PLATFORMS) {
      expect(allowed).toContain(platform);
    }
  });

  it("keeps ALL_MIGRATIONS.sql a faithful in-order copy of every migration", () => {
    const dir = migrationsDir();
    const bundle = readFileSync(join(dir, "ALL_MIGRATIONS.sql"), "utf8");
    let cursor = 0;
    for (const file of migrationFiles()) {
      const body = readFileSync(join(dir, file), "utf8").trim();
      const at = bundle.indexOf(body, cursor);
      expect(at, `${file} missing from ALL_MIGRATIONS.sql or out of order`).toBeGreaterThan(-1);
      cursor = at + body.length;
    }
  });
});

function migrationsDir(): string {
  return join(__dirname, "..", "supabase", "migrations");
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir())
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
}

/** The platform list from the newest migration that redefines the constraint. */
function latestChannelsPlatformConstraint(): string[] {
  const dir = migrationsDir();

  for (const file of [...migrationFiles()].reverse()) {
    const sql = readFileSync(join(dir, file), "utf8");
    const match = sql.match(
      /channels[\s\S]*?platform[\s\S]*?check\s*\(\s*platform\s+in\s*\(([^)]*)\)/i
    );
    if (match) {
      return match[1]
        .split(",")
        .map((v) => v.trim().replace(/^'|'$/g, ""))
        .sort();
    }
  }
  throw new Error("no migration defines the channels platform constraint");
}
