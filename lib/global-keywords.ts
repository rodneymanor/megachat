/**
 * Global keywords: exact-match words a contact can DM to manage their own
 * subscription, checked before any flow trigger runs (see
 * app/api/webhooks/late/route.ts).
 *
 * The stored shape is `[{ keyword, action }]`. Settings used to save bare
 * strings instead, which the webhook then read as objects -- `kw.keyword`
 * was `undefined` and `.toLowerCase()` threw, killing the whole
 * post-response message handler, so a single saved keyword silently
 * disabled trigger matching and flow execution for the workspace. Parsing
 * goes through `normalizeGlobalKeywords` now so both shapes are accepted
 * and neither can throw.
 *
 * A legacy bare string has no recorded action, so it normalizes to
 * `action: null` and is skipped at match time -- the same "nothing happens"
 * outcome those entries already had, without the crash. Settings surfaces
 * them as needing an action so they can be fixed.
 */

import type { Json } from "@/lib/types/database";

export const GLOBAL_KEYWORD_ACTIONS = ["unsubscribe", "subscribe"] as const;

export type GlobalKeywordAction = (typeof GLOBAL_KEYWORD_ACTIONS)[number];

export interface GlobalKeywordRule {
  keyword: string;
  /** null = stored without an action (legacy string entry); never matches. */
  action: GlobalKeywordAction | null;
}

function isAction(value: unknown): value is GlobalKeywordAction {
  return (
    typeof value === "string" &&
    (GLOBAL_KEYWORD_ACTIONS as readonly string[]).includes(value)
  );
}

/** Parse whatever is in `workspaces.global_keywords` into usable rules. */
export function normalizeGlobalKeywords(raw: unknown): GlobalKeywordRule[] {
  if (!Array.isArray(raw)) return [];

  const rules: GlobalKeywordRule[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    let keyword: string | undefined;
    let action: GlobalKeywordAction | null = null;

    if (typeof entry === "string") {
      keyword = entry;
    } else if (entry && typeof entry === "object") {
      const candidate = (entry as { keyword?: unknown }).keyword;
      if (typeof candidate === "string") keyword = candidate;
      const rawAction = (entry as { action?: unknown }).action;
      if (isAction(rawAction)) action = rawAction;
    }

    const normalized = keyword?.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    rules.push({ keyword: normalized, action });
  }

  return rules;
}

/**
 * The rule an inbound message triggers, or null. Matching is exact on the
 * trimmed, lowercased message -- "stop" fires, "please stop" does not --
 * because these commands take priority over every flow trigger and must not
 * swallow ordinary conversation.
 */
export function matchGlobalKeyword(
  rules: GlobalKeywordRule[],
  text: string | undefined | null
): GlobalKeywordRule | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  return (
    rules.find((rule) => rule.action !== null && rule.keyword === normalized) ??
    null
  );
}

/**
 * Back to the stored JSON shape. Always writes explicit `{ keyword, action }`
 * objects so nothing new lands in the database as a legacy bare string.
 */
export function serializeGlobalKeywords(rules: GlobalKeywordRule[]): Json {
  return rules.map((rule): Json => ({
    keyword: rule.keyword,
    action: rule.action,
  }));
}
