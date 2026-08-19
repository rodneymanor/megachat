import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { isWorkspaceActive, getQuotaContext } from "./billing";

/**
 * Fake Supabase client covering the single query shape billing.ts uses:
 * .from("workspace_billing").select(...).eq("workspace_id", id).single().
 * `row: null` simulates the no-row case (PGRST116), matching how a
 * never-activated workspace looks in the real table.
 */
function makeFakeSupabase(row: Record<string, unknown> | null) {
  const client = {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                single() {
                  if (row === null) {
                    return Promise.resolve({
                      data: null,
                      error: { code: "PGRST116", message: "no rows" },
                    });
                  }
                  return Promise.resolve({ data: row, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isWorkspaceActive", () => {
  it("is always active when not in hosted mode, regardless of the row", async () => {
    vi.stubEnv("HOSTED_MODE", undefined);
    const supabase = makeFakeSupabase(null);

    expect(await isWorkspaceActive(supabase, "ws-1")).toBe(true);
  });

  it("is inactive in hosted mode when the workspace has no billing row", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    const supabase = makeFakeSupabase(null);

    expect(await isWorkspaceActive(supabase, "ws-1")).toBe(false);
  });

  it("is active in hosted mode when status is 'active'", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    const supabase = makeFakeSupabase({ status: "active" });

    expect(await isWorkspaceActive(supabase, "ws-1")).toBe(true);
  });

  it("is inactive in hosted mode when status is 'past_due'", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    const supabase = makeFakeSupabase({ status: "past_due" });

    expect(await isWorkspaceActive(supabase, "ws-1")).toBe(false);
  });

  it("fails closed on a query error other than no-rows", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: "500", message: "connection reset" },
                    }),
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient<Database>;

    expect(await isWorkspaceActive(client, "ws-1")).toBe(false);
  });
});

describe("getQuotaContext", () => {
  it("is undefined when not in hosted mode", async () => {
    vi.stubEnv("HOSTED_MODE", undefined);
    const supabase = makeFakeSupabase({ dm_daily_cap: 200 });

    expect(await getQuotaContext(supabase, "ws-1")).toBeUndefined();
  });

  it("uses the workspace's dm_daily_cap when the row has one", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    const supabase = makeFakeSupabase({ dm_daily_cap: 50 });

    const ctx = await getQuotaContext(supabase, "ws-1");
    expect(ctx).toMatchObject({ workspaceId: "ws-1", cap: 50 });
  });

  it("falls back to DAILY_DM_CAP when there is no row but the env default is set", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    vi.stubEnv("DAILY_DM_CAP", "75");
    const supabase = makeFakeSupabase(null);

    const ctx = await getQuotaContext(supabase, "ws-1");
    expect(ctx).toMatchObject({ workspaceId: "ws-1", cap: 75 });
  });

  it("is undefined when hosted with no row and no env default", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    vi.stubEnv("DAILY_DM_CAP", undefined);
    const supabase = makeFakeSupabase(null);

    expect(await getQuotaContext(supabase, "ws-1")).toBeUndefined();
  });

  it("falls back to DAILY_DM_CAP when the row's dm_daily_cap is null", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    vi.stubEnv("DAILY_DM_CAP", "10");
    const supabase = makeFakeSupabase({ dm_daily_cap: null });

    const ctx = await getQuotaContext(supabase, "ws-1");
    expect(ctx).toMatchObject({ workspaceId: "ws-1", cap: 10 });
  });

  it("returns a context with cap 0 for an explicit dm_daily_cap of 0, so the workspace is blocked rather than unlimited", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    const supabase = makeFakeSupabase({ dm_daily_cap: 0 });

    // A falsy-but-explicit 0 must not be mistaken for "no cap configured".
    // It still needs to flow through as a context — consume_dm_quota is the
    // component that turns cap <= 0 into a fail-closed block on send.
    const ctx = await getQuotaContext(supabase, "ws-1");
    expect(ctx).toMatchObject({ workspaceId: "ws-1", cap: 0 });
  });

  it("does not let the DAILY_DM_CAP env default override an explicit dm_daily_cap of 0", async () => {
    vi.stubEnv("HOSTED_MODE", "true");
    vi.stubEnv("DAILY_DM_CAP", "75");
    const supabase = makeFakeSupabase({ dm_daily_cap: 0 });

    // 0 is not nullish, so `??` must not fall through to the env default.
    const ctx = await getQuotaContext(supabase, "ws-1");
    expect(ctx).toMatchObject({ workspaceId: "ws-1", cap: 0 });
  });
});
