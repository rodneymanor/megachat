import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicAppUrl, isHostedMode, isSupabaseConfigured } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSupabaseConfigured", () => {
  it("requires real values for every Supabase runtime variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_real-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_real-key");

    expect(isSupabaseConfigured()).toBe(true);
  });

  it("rejects installer placeholders", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key");

    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe("isHostedMode", () => {
  it("only enables activation gating for the exact value true", () => {
    vi.stubEnv("HOSTED_MODE", "true");
    expect(isHostedMode()).toBe(true);

    vi.stubEnv("HOSTED_MODE", "false");
    expect(isHostedMode()).toBe(false);
  });
});

describe("getPublicAppUrl", () => {
  it("prefers the explicit custom-domain override", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://chat.example.com/ ");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "megachat.vercel.app");

    expect(getPublicAppUrl()).toBe("https://chat.example.com");
  });

  it("uses Vercel's production URL without another setup value", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "megachat.vercel.app");

    expect(getPublicAppUrl()).toBe("https://megachat.vercel.app");
  });
});
