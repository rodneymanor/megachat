import { describe, it, expect } from "vitest";
import { resolveAiGatewayKey } from "./ai-response";

describe("resolveAiGatewayKey", () => {
  it("hosted + workspace key: uses the workspace key", () => {
    expect(resolveAiGatewayKey("ws-key", "env-key", true)).toBe("ws-key");
  });

  it("hosted + no workspace key: never falls back to the env key (no deployer OIDC billing)", () => {
    expect(resolveAiGatewayKey(null, "env-key", true)).toBeUndefined();
  });

  it("self-host + workspace key: uses the workspace key", () => {
    expect(resolveAiGatewayKey("ws-key", "env-key", false)).toBe("ws-key");
  });

  it("self-host + no workspace key: falls back to the env key", () => {
    expect(resolveAiGatewayKey(null, "env-key", false)).toBe("env-key");
  });

  it("self-host + no workspace key + no env key: undefined (createGateway's own OIDC fallback)", () => {
    expect(resolveAiGatewayKey(null, undefined, false)).toBeUndefined();
  });
});
