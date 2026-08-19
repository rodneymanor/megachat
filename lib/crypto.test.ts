import { describe, it, expect, afterEach, vi } from "vitest";
import { encryptSecret, decryptSecret, tryDecryptSecret } from "./crypto";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value when ENCRYPTION_KEY is set", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    const encrypted = encryptSecret("my-secret-api-key");
    expect(encrypted).not.toBe("my-secret-api-key");
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("my-secret-api-key");
  });

  it("produces the enc:v1: format with 3 base64 segments", () => {
    vi.stubEnv("ENCRYPTION_KEY", "another-key");
    const encrypted = encryptSecret("abc123");
    const rest = encrypted.slice("enc:v1:".length);
    expect(rest.split(":")).toHaveLength(3);
  });

  it("is forgiving of any ENCRYPTION_KEY string (derives via sha256)", () => {
    vi.stubEnv("ENCRYPTION_KEY", "short");
    const encrypted = encryptSecret("value");
    expect(decryptSecret(encrypted)).toBe("value");
  });

  it("passes plaintext through unchanged on encrypt when ENCRYPTION_KEY is unset", () => {
    vi.stubEnv("ENCRYPTION_KEY", undefined);
    expect(encryptSecret("plain-key")).toBe("plain-key");
  });

  it("passes empty string through unchanged on encrypt even with ENCRYPTION_KEY set", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    expect(encryptSecret("")).toBe("");
  });

  it("returns legacy plaintext unchanged on decrypt (no enc:v1: prefix)", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    expect(decryptSecret("plain-legacy-key")).toBe("plain-legacy-key");
  });

  it("returns legacy plaintext unchanged on decrypt when ENCRYPTION_KEY is unset", () => {
    vi.stubEnv("ENCRYPTION_KEY", undefined);
    expect(decryptSecret("plain-legacy-key")).toBe("plain-legacy-key");
  });

  it("handles null on decrypt", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    expect(decryptSecret(null)).toBeNull();
  });

  it("handles empty string on decrypt", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    expect(decryptSecret("")).toBe("");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    const encrypted = encryptSecret("my-secret-api-key");
    const parts = encrypted.split(":");
    // Corrupt the ciphertext segment (last part).
    const corrupted = [...parts.slice(0, -1), "corruptedBase64Value=="].join(":");
    expect(() => decryptSecret(corrupted)).toThrow(/ENCRYPTION_KEY mismatch/);
  });

  it("throws when decrypting with the wrong ENCRYPTION_KEY", () => {
    vi.stubEnv("ENCRYPTION_KEY", "key-one");
    const encrypted = encryptSecret("my-secret-api-key");

    vi.stubEnv("ENCRYPTION_KEY", "key-two");
    expect(() => decryptSecret(encrypted)).toThrow(/ENCRYPTION_KEY mismatch/);
  });

  it("throws when ENCRYPTION_KEY is unset but a value is enc:v1: tagged", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    const encrypted = encryptSecret("my-secret-api-key");

    vi.stubEnv("ENCRYPTION_KEY", undefined);
    expect(() => decryptSecret(encrypted)).toThrow(/ENCRYPTION_KEY/);
  });
});

describe("tryDecryptSecret", () => {
  it("passes through a valid roundtrip exactly like decryptSecret", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    const encrypted = encryptSecret("my-secret-api-key");
    expect(tryDecryptSecret(encrypted)).toBe("my-secret-api-key");
  });

  it("returns null instead of throwing on an ENCRYPTION_KEY mismatch", () => {
    vi.stubEnv("ENCRYPTION_KEY", "key-one");
    const encrypted = encryptSecret("my-secret-api-key");

    vi.stubEnv("ENCRYPTION_KEY", "key-two");
    expect(() => tryDecryptSecret(encrypted)).not.toThrow();
    expect(tryDecryptSecret(encrypted)).toBeNull();
  });

  it("returns legacy plaintext unchanged (no enc:v1: prefix)", () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    expect(tryDecryptSecret("plain-legacy-key")).toBe("plain-legacy-key");
  });
});
