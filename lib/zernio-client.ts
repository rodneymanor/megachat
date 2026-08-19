/**
 * Zernio API client.
 *
 * Thin wrapper around the official @zernio/node SDK.
 * All endpoints are auto-generated from the OpenAPI spec.
 */

import Zernio from "@zernio/node";
import type { QuotaContext } from "@/lib/billing";

export type { Zernio };

/**
 * Thrown by a quota-wrapped send method when the workspace has exhausted its
 * daily DM cap (hosted mode only). Callers that swallow-all in their catch
 * blocks must check for this and rethrow it — see the rethrow discipline in
 * lib/flow-engine/engine.ts and lib/flow-engine/nodes/ai-response.ts.
 */
export class DmQuotaExceededError extends Error {
  constructor(public readonly workspaceId: string) {
    super(`Daily DM quota exceeded for workspace ${workspaceId}`);
    this.name = "DmQuotaExceededError";
  }
}

/**
 * Atomically consumes one unit of the workspace's daily DM quota via the
 * `consume_dm_quota` RPC (migration 00019). Throws the RPC error verbatim on
 * a query failure, or DmQuotaExceededError when the cap has been reached.
 * Called BEFORE the send so a failed send still counts against the cap
 * (acceptable for anti-abuse purposes — see plan work item 4).
 */
async function consumeQuotaOrThrow(quota: QuotaContext): Promise<void> {
  const { data: allowed, error } = await quota.supabase.rpc("consume_dm_quota", {
    ws_id: quota.workspaceId,
    cap: quota.cap,
  });

  if (error) throw error;
  if (allowed === false) throw new DmQuotaExceededError(quota.workspaceId);
}

/**
 * Wraps exactly the three outbound-DM send methods on a Zernio client with a
 * pre-send quota check. All other methods/properties are untouched. Mutates
 * and returns the same client instance (safe: createZernioClient constructs
 * a fresh instance per call, so nothing else holds a reference before this
 * runs).
 */
export function wrapClientWithQuota(zernio: Zernio, quota: QuotaContext): Zernio {
  const originalSendInboxMessage = zernio.messages.sendInboxMessage;
  zernio.messages.sendInboxMessage = (async (
    ...args: Parameters<typeof originalSendInboxMessage>
  ) => {
    await consumeQuotaOrThrow(quota);
    return originalSendInboxMessage(...args);
  }) as typeof originalSendInboxMessage;

  const originalReplyToInboxPost = zernio.comments.replyToInboxPost;
  zernio.comments.replyToInboxPost = (async (
    ...args: Parameters<typeof originalReplyToInboxPost>
  ) => {
    await consumeQuotaOrThrow(quota);
    return originalReplyToInboxPost(...args);
  }) as typeof originalReplyToInboxPost;

  const originalSendPrivateReplyToComment = zernio.comments.sendPrivateReplyToComment;
  zernio.comments.sendPrivateReplyToComment = (async (
    ...args: Parameters<typeof originalSendPrivateReplyToComment>
  ) => {
    await consumeQuotaOrThrow(quota);
    return originalSendPrivateReplyToComment(...args);
  }) as typeof originalSendPrivateReplyToComment;

  return zernio;
}

/**
 * Creates a Zernio client. Passing a QuotaContext (hosted mode with a cap
 * configured — see lib/billing.ts getQuotaContext) wraps the three outbound
 * send methods with a pre-send daily-quota check. Without it, behavior is
 * exactly the original 1-arg factory (self-host, and the several read-only
 * call sites that never send DMs).
 */
export function createZernioClient(apiKey: string, quota?: QuotaContext): Zernio {
  const client = new Zernio({ apiKey });
  return quota ? wrapClientWithQuota(client, quota) : client;
}
