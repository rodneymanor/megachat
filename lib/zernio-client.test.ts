import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Zernio } from "./zernio-client";
import { createZernioClient, wrapClientWithQuota, DmQuotaExceededError } from "./zernio-client";
import type { QuotaContext } from "@/lib/billing";

/** Fake Zernio-shaped object covering the three quota-gated send methods
 * plus one untouched read method, matching the SDK's namespace shape. */
function fakeZernio() {
  const sendInboxMessage = vi.fn().mockResolvedValue({ data: { data: { messageId: "m1" } } });
  const replyToInboxPost = vi.fn().mockResolvedValue({ data: { ok: true } });
  const sendPrivateReplyToComment = vi.fn().mockResolvedValue({ data: { ok: true } });
  const listInboxConversations = vi.fn().mockResolvedValue({ data: { data: [] } });

  const zernio = {
    messages: { sendInboxMessage, listInboxConversations },
    comments: { replyToInboxPost, sendPrivateReplyToComment },
  } as unknown as Zernio;

  return { zernio, sendInboxMessage, replyToInboxPost, sendPrivateReplyToComment, listInboxConversations };
}

/** Fake Supabase client whose .rpc() is a stubbed vi.fn(), modeled on
 * lib/inbox-sync.test.ts's makeFakeSupabase. */
function fakeSupabase(rpcImpl: (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn().mockImplementation(rpcImpl);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

function quotaContext(
  supabase: SupabaseClient,
  overrides: Partial<QuotaContext> = {}
): QuotaContext {
  return { supabase, workspaceId: "ws-1", cap: 5, ...overrides };
}

describe("wrapClientWithQuota", () => {
  it("passes through with original args when under cap, and calls the RPC with the right params", async () => {
    const { client, rpc } = fakeSupabase(async () => ({ data: true, error: null }));
    const { zernio, sendInboxMessage } = fakeZernio();
    const quota = quotaContext(client, { workspaceId: "ws-1", cap: 5 });

    const wrapped = wrapClientWithQuota(zernio, quota);
    const args = {
      path: { conversationId: "conv-1" },
      body: { accountId: "acc-1", message: "hi" },
    };
    const result = await wrapped.messages.sendInboxMessage(args as never);

    expect(rpc).toHaveBeenCalledWith("consume_dm_quota", { ws_id: "ws-1", cap: 5 });
    expect(sendInboxMessage).toHaveBeenCalledWith(args);
    expect(result).toEqual({ data: { data: { messageId: "m1" } } });
  });

  it("throws DmQuotaExceededError and does not call the send method when the RPC returns false", async () => {
    const { client } = fakeSupabase(async () => ({ data: false, error: null }));
    const { zernio, sendInboxMessage } = fakeZernio();
    const quota = quotaContext(client);

    const wrapped = wrapClientWithQuota(zernio, quota);

    await expect(
      wrapped.messages.sendInboxMessage({
        path: { conversationId: "conv-1" },
        body: { accountId: "acc-1", message: "hi" },
      } as never)
    ).rejects.toThrow(DmQuotaExceededError);
    expect(sendInboxMessage).not.toHaveBeenCalled();
  });

  it("includes the workspace id in the DmQuotaExceededError message", async () => {
    const { client } = fakeSupabase(async () => ({ data: false, error: null }));
    const { zernio } = fakeZernio();
    const quota = quotaContext(client, { workspaceId: "ws-42" });

    const wrapped = wrapClientWithQuota(zernio, quota);

    await expect(
      wrapped.comments.sendPrivateReplyToComment({
        path: { postId: "p1", commentId: "c1" },
        body: { accountId: "acc-1", message: "hi" },
      } as never)
    ).rejects.toMatchObject({ workspaceId: "ws-42" });
  });

  it("propagates an RPC error instead of calling the send method", async () => {
    const rpcError = new Error("connection reset");
    const { client } = fakeSupabase(async () => ({ data: null, error: rpcError }));
    const { zernio, replyToInboxPost } = fakeZernio();
    const quota = quotaContext(client);

    const wrapped = wrapClientWithQuota(zernio, quota);

    await expect(
      wrapped.comments.replyToInboxPost({
        path: { postId: "p1" },
        body: { accountId: "acc-1", message: "hi", commentId: "c1" },
      } as never)
    ).rejects.toBe(rpcError);
    expect(replyToInboxPost).not.toHaveBeenCalled();
  });

  it("leaves a non-send method untouched by the wrapper", async () => {
    const { client, rpc } = fakeSupabase(async () => ({ data: true, error: null }));
    const { zernio, listInboxConversations } = fakeZernio();
    const quota = quotaContext(client);

    const wrapped = wrapClientWithQuota(zernio, quota);
    await wrapped.messages.listInboxConversations();

    expect(listInboxConversations).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("gates all three quota-checked methods independently, once per call", async () => {
    const { client, rpc } = fakeSupabase(async () => ({ data: true, error: null }));
    const { zernio, sendInboxMessage, replyToInboxPost, sendPrivateReplyToComment } = fakeZernio();
    const quota = quotaContext(client);

    const wrapped = wrapClientWithQuota(zernio, quota);
    await wrapped.messages.sendInboxMessage({
      path: { conversationId: "c" },
      body: { accountId: "a", message: "m" },
    } as never);
    await wrapped.comments.replyToInboxPost({
      path: { postId: "p" },
      body: { accountId: "a", message: "m", commentId: "c" },
    } as never);
    await wrapped.comments.sendPrivateReplyToComment({
      path: { postId: "p", commentId: "c" },
      body: { accountId: "a", message: "m" },
    } as never);

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(sendInboxMessage).toHaveBeenCalledTimes(1);
    expect(replyToInboxPost).toHaveBeenCalledTimes(1);
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
  });
});

describe("createZernioClient", () => {
  it("returns an unwrapped client when called with one argument (read-only call sites)", async () => {
    const client = createZernioClient("api-key-1");
    // No quota context means the send methods are the SDK's own, unmodified
    // functions -- calling one must not touch a Supabase client at all (none
    // was ever provided), and must not throw DmQuotaExceededError.
    expect(typeof client.messages.sendInboxMessage).toBe("function");
    expect(typeof client.comments.replyToInboxPost).toBe("function");
    expect(typeof client.comments.sendPrivateReplyToComment).toBe("function");
  });

  it("wraps the client's send methods when a quota context is passed", async () => {
    const { client: supabase, rpc } = fakeSupabase(async () => ({ data: false, error: null }));
    const zernio = createZernioClient("api-key-1", quotaContext(supabase));

    await expect(
      zernio.messages.sendInboxMessage({
        path: { conversationId: "c" },
        body: { accountId: "a", message: "m" },
      } as never)
    ).rejects.toThrow(DmQuotaExceededError);
    expect(rpc).toHaveBeenCalledWith("consume_dm_quota", { ws_id: "ws-1", cap: 5 });
  });
});
