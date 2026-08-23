import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getConfig,
} from "@/lib/config";
import { ApiError } from "@/server/http";
import {
  resolveChatEndpoint,
  systemPromptForModel,
} from "@/server/providers/llm";
import { CREDIT_PER_CHAT } from "@/types";
import { reserveCredits } from "@/server/services/credits";
import { assertEnabledTextModel } from "@/server/services/model-access";

export const MAX_CHAT_MESSAGE_LENGTH = 20_000;
const CHAT_STREAM_ERROR = "对话服务暂时不可用，请稍后重试";

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

export async function createChatStream(
  userId: string,
  role: string,
  conversationId: string,
  message: string,
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

  const model = assertEnabledTextModel(conv.model, config);

  // 按模型解析端点后再检查 key（Grok 可用 GROK_API_KEY，不强制 ARK）
  const { apiKey, baseUrl } = resolveChatEndpoint(model, config || {});
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
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        upstreamController = new AbortController();
        timeout = setTimeout(() => upstreamController?.abort(), 180_000);
        const apiRes = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          signal: upstreamController.signal,
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: conv.model,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 4000,
            stream: true,
          }),
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
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "token", text: delta.content })}\n\n`,
                  ),
                );
              }
              if (
                typeof delta?.reasoning_content === "string" &&
                delta.reasoning_content
              ) {
                chargeState.markContent();
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "reasoning", text: delta.reasoning_content })}\n\n`,
                  ),
                );
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

        if (fullResponse) {
          await db.insert(messages).values({
            conversationId,
            role: "assistant",
            content: fullResponse,
          });
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
        );
        controller.close();
      } catch (err: unknown) {
        await refundQuietly(chargeState, "对话上游失败退款");
        console.error(
          "Chat stream error:",
          err instanceof Error ? err.message : "unknown error",
        );
        if (!clientCancelled) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", text: CHAT_STREAM_ERROR })}\n\n`,
              ),
            );
            controller.close();
          } catch {
            // The client may have cancelled the stream while the upstream failed.
          }
        }
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
