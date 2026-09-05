import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getConfig,
} from "@/lib/config";
import { ApiError } from "@/server/http";
import { systemPromptForModel } from "@/server/providers/llm";
import { CREDIT_PER_CHAT } from "@/types";
import { reserveCredits } from "@/server/services/credits";
import {
  isConfiguredModelEnabled,
  resolveConfiguredEndpoint,
} from "@/server/services/model-channels";
import { providerIdempotencyKey } from "@/server/services/request-idempotency";
import {
  DEFAULT_ASSISTANT_IMAGE_PROMPT,
  detectAssistantAppearanceIntent,
} from "@/lib/conversational-image-intent";
import {
  generateImage,
  IMAGE_UPSTREAM_TIMEOUT_MS,
} from "@/server/services/image";
import {
  createAssistantImageErrorMessage,
  createAssistantImageMessage,
} from "@/server/services/chat-image";
import {
  completeRequest,
  failRequest,
} from "@/server/services/request-idempotency-store";
import { requestPublicHttpsResponse } from "@/server/safe-http";

export const MAX_CHAT_MESSAGE_LENGTH = 20_000;
const CHAT_STREAM_ERROR = "对话服务暂时不可用，请稍后重试";
const MAX_CHAT_UPSTREAM_BYTES = 4 * 1024 * 1024;

interface ChatCreditReservation {
  refund(note: string): Promise<void>;
}

export function createChatChargeState(
  reservation: ChatCreditReservation | null,
): {
  markContent(): void;
  failBeforeContent(note: string): Promise<void>;
  hasContent(): boolean;
} {
  let contentEmitted = false;
  let refundCompleted = false;
  let refundInFlight: Promise<void> | null = null;

  return {
    markContent() {
      contentEmitted = true;
    },
    async failBeforeContent(note: string) {
      if (!reservation || contentEmitted || refundCompleted) return;
      if (refundInFlight) return refundInFlight;
      refundInFlight = reservation.refund(note).then(
        () => {
          refundCompleted = true;
        },
        (error) => {
          refundInFlight = null;
          throw error;
        },
      );
      await refundInFlight;
      refundInFlight = null;
    },
    hasContent() {
      return contentEmitted;
    },
  };
}

async function refundQuietly(
  chargeState: ReturnType<typeof createChatChargeState>,
  note: string,
) {
  try {
    await chargeState.failBeforeContent(note);
  } catch (refundError: unknown) {
    console.error(
      "Chat refund error:",
      refundError instanceof Error ? refundError.message : "unknown error",
    );
  }
}

function eventLine(payload: unknown, encoder: TextEncoder) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function createImageChatStream(
  userId: string,
  role: string,
  conversationId: string,
  userPrompt: string,
  assistantImagePrompt: string,
  imageModel: string,
  options: {
    requestId?: string;
    requestLeaseToken?: string;
    idempotencyKey?: string;
  },
): Response {
  const encoder = new TextEncoder();
  const events: Array<Record<string, unknown>> = [];
  const operationController = new AbortController();
  const operationSignal = AbortSignal.any([
    operationController.signal,
    AbortSignal.timeout(IMAGE_UPSTREAM_TIMEOUT_MS),
  ]);
  let clientCancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        events.push(payload);
        if (!clientCancelled) controller.enqueue(eventLine(payload, encoder));
      };
      send({ type: "image_started", prompt: userPrompt });

      let assistantMessage: ReturnType<typeof createAssistantImageMessage>;
      let terminalEvent: Record<string, unknown>;
      try {
        const image = await generateImage({
          userId,
          role,
          prompt: `${assistantImagePrompt || DEFAULT_ASSISTANT_IMAGE_PROMPT}\n\n${userPrompt}`,
          modelOverride: imageModel,
          size: "1024x1024",
          idempotencyKey: options.idempotencyKey
            ? providerIdempotencyKey("chat-image", options.idempotencyKey)
            : undefined,
          signal: operationSignal,
        });
        assistantMessage = createAssistantImageMessage(image);
        terminalEvent = { type: "image_done", message: assistantMessage };
      } catch (error: unknown) {
        const publicMessage =
          error instanceof ApiError ? error.message : "图片生成失败，请稍后重试";
        assistantMessage = createAssistantImageErrorMessage(
          userPrompt,
          publicMessage,
        );
        terminalEvent = { type: "image_error", message: assistantMessage };
      }

      const finalEvents = [...events, terminalEvent, { type: "done" }];
      try {
        await db.transaction(async (tx) => {
          await tx.insert(messages).values({
            conversationId,
            role: "assistant",
            content: assistantMessage.content,
            metadata: assistantMessage.metadata,
          });
          if (options.requestId && options.requestLeaseToken) {
            await completeRequest(
              options.requestId,
              options.requestLeaseToken,
              200,
              { events: finalEvents },
              tx,
            );
          }
        });
      } catch (error) {
        if (options.requestId && options.requestLeaseToken) {
          await failRequest(
            options.requestId,
            options.requestLeaseToken,
            500,
            {
              error: "图片消息保存失败，请使用新的请求 ID 重试",
              code: "CHAT_IMAGE_FINALIZATION_FAILED",
            },
          ).catch((recordError) =>
            console.error("Failed to persist image chat finalization", recordError),
          );
        }
        console.error(
          "Image chat finalization failed:",
          error instanceof Error ? error.message : "unknown error",
        );
        if (!clientCancelled) controller.error(new Error("image chat failed"));
        return;
      }
      send(terminalEvent);
      send({ type: "done" });
      if (!clientCancelled) controller.close();
    },
    cancel() {
      clientCancelled = true;
      operationController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function createChatStream(
  userId: string,
  role: string,
  conversationId: string,
  message: string,
  options: {
    requestId?: string;
    requestLeaseToken?: string;
    idempotencyKey?: string;
  } = {},
): Promise<Response> {
  if (!conversationId || !message?.trim()) {
    throw new ApiError("conversationId 和 message 为必填项", 400);
  }
  if (message.trim().length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new ApiError(
      `对话内容不能超过 ${MAX_CHAT_MESSAGE_LENGTH} 个字符`,
      400,
    );
  }

  const config = await getConfig();

  const convs = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    );
  const conv = convs[0];
  if (!conv) throw new ApiError("对话不存在", 404);

  const imageIntent = detectAssistantAppearanceIntent(message);
  if (imageIntent) {
    await db.transaction(async (tx) => {
      await tx.insert(messages).values({
        conversationId,
        role: "user",
        content: message,
      });
      const title =
        conv.title === "新对话"
          ? message.slice(0, 30) + (message.length > 30 ? "..." : "")
          : conv.title;
      await tx
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    });
    return createImageChatStream(
      userId,
      role,
      conversationId,
      imageIntent.prompt,
      config?.assistantImagePrompt || "",
      config?.imageModel || "doubao-seedream-4-5-251128",
      options,
    );
  }

  const model = conv.model;
  if (!(await isConfiguredModelEnabled(config || {}, "text", model))) {
    throw new ApiError("指定的模型不可用", 400);
  }

  // 按模型解析端点后再检查 key（Grok 可用 GROK_API_KEY，不强制 ARK）
  const { apiKey, baseUrl, enforcePublicHttps } = await resolveConfiguredEndpoint(
    "text",
    model,
    config || {},
  );
  if (!apiKey) {
    const isGrok = model.startsWith("grok-");
    throw new ApiError(
      isGrok
        ? "请在 .env.local 中设置 GROK_API_KEY，或在设置中配置可用的 API Key"
        : "请先在设置中配置 API Key 或在 .env.local 中设置 ARK_API_KEY",
      400,
    );
  }
  if (!baseUrl) {
    throw new ApiError("未配置 API Base URL", 400);
  }

  // 积分：管理员免费；普通用户在持久化消息和调用上游前预扣。
  const chargeCredits = role !== "admin";
  const reservation =
    userId && chargeCredits
      ? await reserveCredits(
          userId,
          CREDIT_PER_CHAT,
          `对话: ${message.slice(0, 50)}`,
        )
      : null;
  const chargeState = createChatChargeState(reservation);

  let chatMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  try {
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    chatMessages = [
      { role: "system" as const, content: systemPromptForModel(model) },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    await db.transaction(async (tx) => {
      await tx.insert(messages).values({
        conversationId,
        role: "user",
        content: message,
      });

      if (conv.title === "新对话") {
        const title =
          message.slice(0, 30) + (message.length > 30 ? "..." : "");
        await tx
          .update(conversations)
          .set({ title, updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      } else {
        await tx
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }
    });
  } catch (error: unknown) {
    await refundQuietly(chargeState, "对话消息保存失败退款");
    throw error;
  }

  const encoder = new TextEncoder();
  let clientCancelled = false;
  let upstreamController: AbortController | undefined;
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      const events: Array<Record<string, unknown>> = [];
      const send = (payload: Record<string, unknown>) => {
        events.push(payload);
        if (!clientCancelled) controller.enqueue(eventLine(payload, encoder));
      };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        upstreamController = new AbortController();
        timeout = setTimeout(() => upstreamController?.abort(), 180_000);
        const upstreamUrl = `${baseUrl}/chat/completions`;
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(options.idempotencyKey
            ? {
                "Idempotency-Key": providerIdempotencyKey(
                  "chat",
                  options.idempotencyKey,
                ),
              }
            : {}),
        };
        const body = JSON.stringify({
          model: conv.model,
          messages: chatMessages,
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        });
        const apiRes = enforcePublicHttps
          ? await requestPublicHttpsResponse(upstreamUrl, {
              method: "POST",
              signal: upstreamController.signal,
              headers,
              body,
              timeoutMs: 180_000,
              maxBytes: MAX_CHAT_UPSTREAM_BYTES,
            })
          : await fetch(upstreamUrl, {
          method: "POST",
          signal: upstreamController.signal,
          redirect: "error",
          headers,
          body,
        });

        if (!apiRes.ok) {
          console.error("Chat upstream error:", apiRes.status);
          throw new Error("chat upstream request failed");
        }

        upstreamReader = apiRes.body?.getReader();
        if (!upstreamReader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (typeof delta?.content === "string" && delta.content) {
                chargeState.markContent();
                fullResponse += delta.content;
                send({ type: "token", text: delta.content });
              }
              if (
                typeof delta?.reasoning_content === "string" &&
                delta.reasoning_content
              ) {
                chargeState.markContent();
                send({ type: "reasoning", text: delta.reasoning_content });
              }
            } catch {
              /* skip malformed */
            }
          }
        }

        if (!chargeState.hasContent()) {
          await chargeState.failBeforeContent("对话无有效内容退款");
          throw new Error("chat upstream returned no content");
        }

        const finalEvents = [...events, { type: "done" }];
        await db.transaction(async (tx) => {
          if (fullResponse) {
            await tx.insert(messages).values({
              conversationId,
              role: "assistant",
              content: fullResponse,
            });
          }
          if (options.requestId && options.requestLeaseToken) {
            await completeRequest(
              options.requestId,
              options.requestLeaseToken,
              200,
              { events: finalEvents },
              tx,
            );
          }
        });
        send({ type: "done" });
        if (!clientCancelled) controller.close();
      } catch (err: unknown) {
        await refundQuietly(chargeState, "对话上游失败退款");
        console.error(
          "Chat stream error:",
          err instanceof Error ? err.message : "unknown error",
        );
        send({ type: "error", text: CHAT_STREAM_ERROR });
        if (options.requestId && options.requestLeaseToken) {
          await completeRequest(
            options.requestId,
            options.requestLeaseToken,
            200,
            { events },
          ).catch(
            (recordError) =>
              console.error("Failed to persist chat request failure", recordError),
          );
        }
        if (!clientCancelled) controller.close();
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
    cancel() {
      clientCancelled = true;
      upstreamController?.abort();
      void upstreamReader?.cancel("client cancelled");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function replayChatStream(body: Record<string, unknown>): Response {
  const encoder = new TextEncoder();
  const events = Array.isArray(body.events)
    ? body.events.filter(
        (event): event is Record<string, unknown> =>
          typeof event === "object" && event !== null,
      )
    : null;
  const text = typeof body.text === "string" ? body.text : "";
  const replayEvents = events ?? [
    { type: "token", text },
    { type: "done" },
  ];
  const payload = replayEvents
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(encoder.encode(payload), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
