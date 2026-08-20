import { describe, it, expect } from "vitest";
import {
  matchGlobalKeyword,
  normalizeGlobalKeywords,
  type GlobalKeywordRule,
} from "@/lib/global-keywords";

describe("normalizeGlobalKeywords", () => {
  it("reads the stored { keyword, action } shape", () => {
    expect(
      normalizeGlobalKeywords([
        { keyword: "stop", action: "unsubscribe" },
        { keyword: "start", action: "subscribe" },
      ])
    ).toEqual([
      { keyword: "stop", action: "unsubscribe" },
      { keyword: "start", action: "subscribe" },
    ]);
  });

  it("lowercases and trims keywords", () => {
    expect(normalizeGlobalKeywords([{ keyword: "  STOP ", action: "unsubscribe" }])).toEqual([
      { keyword: "stop", action: "unsubscribe" },
    ]);
  });

  it("keeps legacy bare strings but leaves them action-less", () => {
    expect(normalizeGlobalKeywords(["stop"])).toEqual([
      { keyword: "stop", action: null },
    ]);
  });

  it("drops an unrecognized action rather than trusting it", () => {
    expect(
      normalizeGlobalKeywords([{ keyword: "stop", action: "delete-everything" }])
    ).toEqual([{ keyword: "stop", action: null }]);
  });

  it("skips entries with no usable keyword instead of throwing", () => {
    expect(
      normalizeGlobalKeywords([
        null,
        undefined,
        42,
        {},
        { action: "unsubscribe" },
        { keyword: "   " },
        { keyword: "stop", action: "unsubscribe" },
      ])
    ).toEqual([{ keyword: "stop", action: "unsubscribe" }]);
  });

  it("keeps only the first of duplicate keywords", () => {
    expect(
      normalizeGlobalKeywords([
        { keyword: "stop", action: "unsubscribe" },
        { keyword: "STOP", action: "subscribe" },
      ])
    ).toEqual([{ keyword: "stop", action: "unsubscribe" }]);
  });

  it("returns nothing for a non-array value", () => {
    expect(normalizeGlobalKeywords(null)).toEqual([]);
    expect(normalizeGlobalKeywords({ keyword: "stop" })).toEqual([]);
  });
});

describe("matchGlobalKeyword", () => {
  const rules: GlobalKeywordRule[] = [
    { keyword: "stop", action: "unsubscribe" },
    { keyword: "start", action: "subscribe" },
    { keyword: "legacy", action: null },
  ];

  it("matches an exact message, ignoring case and surrounding space", () => {
    expect(matchGlobalKeyword(rules, "  STOP ")?.action).toBe("unsubscribe");
    expect(matchGlobalKeyword(rules, "start")?.action).toBe("subscribe");
  });

  it("does not match a keyword embedded in a sentence", () => {
    expect(matchGlobalKeyword(rules, "please stop sending these")).toBeNull();
  });

  it("never matches an action-less legacy rule", () => {
    expect(matchGlobalKeyword(rules, "legacy")).toBeNull();
  });

  it("handles empty and missing text", () => {
    expect(matchGlobalKeyword(rules, "")).toBeNull();
    expect(matchGlobalKeyword(rules, "   ")).toBeNull();
    expect(matchGlobalKeyword(rules, undefined)).toBeNull();
  });
});
