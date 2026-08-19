import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FlowExecutionContext, AiResponseNodeData } from "../types";
import { createZernioClient, DmQuotaExceededError } from "@/lib/zernio-client";
import { getQuotaContext } from "@/lib/billing";
import { isHostedMode } from "@/lib/config";
import { tryDecryptSecret } from "@/lib/crypto";
import { generateText, createGateway } from "ai";

// Halt the run: continuing would let a downstream Send Message deliver the
// literal "{{ai_response}}" token to the contact (same pause mechanism as
// humanTakeover, but the session is cancelled rather than completed).
async function cancelRun(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<"pause"> {
  await supabase
    .from("flow_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);
  return "pause";
}

/**
 * Resolves which AI Gateway key to use, if any. Hosted mode NEVER falls back
 * to the deployment's own env key — without a workspace key, createGateway
 * would fall back to Vercel OIDC and bill the deployer (Rodney) for a user's
 * traffic. Self-host keeps the original fallback: it's their Vercel, their
 * bill, and the whole point is zero-config out of the box.
 */
export function resolveAiGatewayKey(
  workspaceKey: string | null,
  envKey: string | undefined,
  hosted: boolean
): string | undefined {
  if (hosted) return workspaceKey ?? undefined;
  return workspaceKey || envKey || undefined;
}

export async function executeAiResponse(
  supabase: SupabaseClient<Database>,
  data: AiResponseNodeData,
  context: FlowExecutionContext,
  sessionId: string
) {
  // Get workspace for Zernio API key + AI Gateway key
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted, ai_api_key")
    .eq("id", context.workspaceId)
    .single();

  // Hosted mode: without the workspace's own AI Gateway key, generateText
  // below would fall back to Vercel OIDC and bill the deployer. Cancel
  // before any generateText call — never let this run unmetered.
  if (isHostedMode() && !workspace?.ai_api_key) {
    console.error(
      "Hosted mode: no AI Gateway key configured for workspace, cancelling run to avoid unmetered deployer billing:",
      context.workspaceId
    );
    await supabase.from("analytics_events").insert({
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      contact_id: context.contactId,
      event_type: "message_failed",
      metadata: { reason: "ai_key_missing" },
    });
    return cancelRun(supabase, sessionId);
  }

  const zernioKey = tryDecryptSecret(workspace?.late_api_key_encrypted ?? null);
  if (!zernioKey) {
    console.error("No Zernio API key for workspace:", context.workspaceId);
    return cancelRun(supabase, sessionId);
  }

  // Decrypt the AI Gateway key up front (not inside the try below) so a
  // decrypt failure can be told apart from "no key configured" here, before
  // any generateText call. tryDecryptSecret never throws; a null result
  // with a non-null raw column means the ciphertext failed to decrypt
  // (e.g. ENCRYPTION_KEY rotated) — the earlier presence-check above only
  // confirmed the column was non-null, not that it decrypts.
  const rawAiKey = workspace?.ai_api_key ?? null;
  const decryptedAiKey = tryDecryptSecret(rawAiKey);
  if (isHostedMode() && rawAiKey && !decryptedAiKey) {
    console.error(
      "Hosted mode: AI Gateway key failed to decrypt (likely an ENCRYPTION_KEY mismatch), cancelling run to avoid unmetered deployer billing:",
      context.workspaceId
    );
    await supabase.from("analytics_events").insert({
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      contact_id: context.contactId,
      event_type: "message_failed",
      metadata: { reason: "ai_key_missing" },
    });
    return cancelRun(supabase, sessionId);
  }

  const quota = await getQuotaContext(supabase, context.workspaceId);
  const zernio = createZernioClient(zernioKey, quota);

  // Resolve late_account_id from channel if not in context
  let lateAccountId = context.lateAccountId;
  if (!lateAccountId) {
    const { data: channel } = await supabase
      .from("channels")
      .select("late_account_id, platform")
      .eq("id", context.channelId)
      .single();

    if (!channel) {
      console.error("No channel found for id:", context.channelId);
      return cancelRun(supabase, sessionId);
    }
    lateAccountId = channel.late_account_id;
    if (!context.platform) {
      context.platform = channel.platform as FlowExecutionContext["platform"];
    }
  }

  // Resolve late_conversation_id from conversation if not in context
  let lateConversationId = context.lateConversationId;
  if (!lateConversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("late_conversation_id")
      .eq("id", context.conversationId)
      .single();

    if (!conversation?.late_conversation_id) {
      console.error("No late_conversation_id found for conversation:", context.conversationId);
      return cancelRun(supabase, sessionId);
    }
    lateConversationId = conversation.late_conversation_id;
  }

  // Fetch last N messages from the conversation for context
  const contextMessages = data.contextMessages || 10;
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("direction, text")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: false })
    .limit(contextMessages);

  // Build messages array for the AI
  const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (recentMessages && recentMessages.length > 0) {
    // Reverse to get chronological order (oldest first)
    const chronological = [...recentMessages].reverse();
    for (const msg of chronological) {
      if (!msg.text) continue;
      aiMessages.push({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.text,
      });
    }
  }

  try {
    const model = data.model || "openai/gpt-4o-mini";
    const aiGatewayKey = resolveAiGatewayKey(
      decryptedAiKey,
      process.env.AI_GATEWAY_API_KEY,
      isHostedMode()
    );
    const gw = createGateway({ apiKey: aiGatewayKey || undefined });
    const result = await generateText({
      model: gw(model),
      system: data.systemPrompt || "You are a helpful customer support agent.",
      messages: aiMessages,
      temperature: data.temperature ?? 0.7,
      maxOutputTokens: data.maxTokens ?? 500,
    });

    const text = result.text;

    // Expose the generated text to downstream nodes as {{ai_response}}
    context.variables = { ...(context.variables ?? {}), ai_response: text };

    if (data.sendDirectly !== false) {
      // Send via Zernio REST API (same pattern as executeSendMessage)
      const response = await zernio.messages.sendInboxMessage({
        path: { conversationId: lateConversationId },
        body: { accountId: lateAccountId, message: text },
      });

      // Store outbound message
      await supabase.from("messages").insert({
        conversation_id: context.conversationId,
        direction: "outbound",
        text,
        attachments: null,
        sent_by_flow_id: context.flowId,
        sent_by_node_id: null,
        platform_message_id: response.data?.data?.messageId || null,
        status: "sent",
      });

      await supabase.from("analytics_events").insert({
        workspace_id: context.workspaceId,
        flow_id: context.flowId,
        contact_id: context.contactId,
        event_type: "message_sent",
      });
    }
  } catch (error) {
    // Rethrow so the engine-level handler (traverseNodes) cancels the
    // session and logs the dm_quota_exceeded analytics event. Skip the
    // "[AI response failed]" insert below — the send never actually failed,
    // it was never attempted.
    if (error instanceof DmQuotaExceededError) throw error;

    console.error("Failed to generate or send AI response:", error);

    await supabase.from("messages").insert({
      conversation_id: context.conversationId,
      direction: "outbound",
      text: "[AI response failed]",
      sent_by_flow_id: context.flowId,
      status: "failed",
    });

    await supabase.from("analytics_events").insert({
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      contact_id: context.contactId,
      event_type: "message_failed",
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    return cancelRun(supabase, sessionId);
  }
}
