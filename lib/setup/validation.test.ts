import { describe, expect, it } from "vitest";
import {
  normalizeSupabaseConnectionString,
  normalizeSupabaseProjectUrl,
  validateSetupValues,
  validateSupabaseConnectionString,
} from "./validation";

const legacyKey = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature";

describe("validateSetupValues", () => {
  it("accepts current Supabase key formats and a Session pooler URI", () => {
    expect(validateSetupValues({
      supabaseUrl: "https://abcdefghijkl.supabase.co",
      publishableKey: "sb_publishable_abcdefghijklmnop",
      secretKey: "sb_secret_abcdefghijklmnop",
      connectionString: "postgresql://postgres.project:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    })).toEqual({});
  });

  it("accepts legacy anon and service_role JWTs", () => {
    const errors = validateSetupValues({
      supabaseUrl: "https://abcdefghijkl.supabase.co",
      publishableKey: legacyKey,
      secretKey: legacyKey,
      connectionString: "postgresql://postgres.abcdefghijkl:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    });

    expect(errors).toEqual({});
  });
});

describe("validateSupabaseConnectionString", () => {
  it("rejects non-Supabase hosts to prevent SSRF", () => {
    expect(validateSupabaseConnectionString("postgresql://user:pass@127.0.0.1:5432/postgres"))
      .toMatch(/only connects to a Supabase Session pooler host/);
  });

  it("requires the password placeholder to be replaced", () => {
    expect(validateSupabaseConnectionString("postgresql://postgres:[YOUR-PASSWORD]@db.project.supabase.co:5432/postgres"))
      .toMatch(/replace \[YOUR-PASSWORD\]/);
  });

  it("rejects transaction-pooler port 6543", () => {
    expect(validateSupabaseConnectionString("postgresql://postgres.project:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"))
      .toMatch(/port 5432/);
  });

  it("rejects a hand-built pooler hostname with the instance segment missing", () => {
    expect(validateSupabaseConnectionString("postgresql://postgres.project:pass@aws-us-west-2.pooler.supabase.com:5432/postgres"))
      .toMatch(/aws-0-region/);
  });

  it("requires the project-qualified pooler username", () => {
    expect(validateSupabaseConnectionString("postgresql://postgres:pass@aws-0-us-west-2.pooler.supabase.com:5432/postgres"))
      .toMatch(/postgres\.project-ref/);
  });
});

describe("setup value normalization", () => {
  it("turns a copied REST endpoint into the Supabase project origin", () => {
    expect(normalizeSupabaseProjectUrl("https://project.supabase.co/rest/v1/"))
      .toBe("https://project.supabase.co");
  });

  it("percent-encodes reserved password characters in a connection URI", () => {
    expect(normalizeSupabaseConnectionString("postgresql://postgres.project:pass^@aws-0-us-west-2.pooler.supabase.com:5432/postgres"))
      .toContain("pass%5E@");
  });
});
