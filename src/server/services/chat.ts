import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { ApiError } from "@/server/http";
import { systemPromptForModel } from "@/server/providers/llm";
import { resolveConfiguredEndpoint } from "@/server/services/model-channels";
import { CREDIT_PER_CHAT } from "@/types";
import { assertEnoughCredits, consumeCredits } from "@/server/services/credits";
import {
  DEFAULT_ASSISTANT_IMAGE_PROMPT,
  detectAssistantAppearanceIntent,
} from "@/lib/conversational-image-intent";
import { generateImage } from "@/server/services/image";
import {
  createAssistantImageErrorMessage,
  createAssistantImageMessage,
} from "@/server/services/chat-image";

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
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(eventLine(payload, encoder));
      send({ type: "image_started", prompt: userPrompt });

      try {
        const image = await generateImage({
          userId,
          role,
          prompt: `${assistantImagePrompt || DEFAULT_ASSISTANT_IMAGE_PROMPT}\n\n${userPrompt}`,
          modelOverride: imageModel,
          size: "1024x1024",
        });
        const assistantMessage = createAssistantImageMessage(image);
        await db.insert(messages).values({
          conversationId,
          role: "assistant",
          content: assistantMessage.content,
          metadata: assistantMessage.metadata,
        });
        send({ type: "image_done", message: assistantMessage });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : "图片生成失败，请稍后重试";
        const errorMessageRecord = createAssistantImageErrorMessage(
          userPrompt,
          errorMessage,
        );
        await db.insert(messages).values({
          conversationId,
          role: "assistant",
          content: errorMessageRecord.content,
          metadata: errorMessageRecord.metadata,
        });
        send({
          type: "image_error",
          message: errorMessageRecord,
        });
      }

      send({ type: "done" });
      controller.close();
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
): Promise<Response> {
  if (!conversationId || !message?.trim()) {
    throw new ApiError("conversationId 和 message 为必填项", 400);
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

  // 积分：管理员免费；普通用户发送前校验余额（回复成功后才扣）。
  // 助手形象生图走图片积分，不预扣对话积分。
  const chargeCredits = role !== "admin";
  if (!imageIntent && userId && chargeCredits) {
    await assertEnoughCredits(userId, CREDIT_PER_CHAT);
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  const chatMessages = [
    { role: "system" as const, content: systemPromptForModel(conv.model) },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  await db.insert(messages).values({
    conversationId,
    role: "user",
    content: message,
  });

  if (conv.title === "新对话") {
    const title =
      message.slice(0, 30) + (message.length > 30 ? "..." : "");
    await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  } else {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  if (imageIntent) {
    return createImageChatStream(
      userId,
      role,
      conversationId,
      imageIntent.prompt,
      config?.assistantImagePrompt || "",
      config?.imageModel || "doubao-seedream-4-5-251128",
    );
  }

  // 按模型解析端点后再检查 key（Grok 可用 GROK_API_KEY，不强制 ARK）
  const { apiKey, baseUrl } = await resolveConfiguredEndpoint(
    "text",
    conv.model,
    config || {},
  );
  if (!apiKey) {
    const isGrok = conv.model.startsWith("grok-");
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      try {
        const apiRes = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
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
          const errText = await apiRes.text();
          throw new Error(`${apiRes.status} ${errText}`);
        }

        const reader = apiRes.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
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
              if (delta?.content) {
                fullResponse += delta.content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "token", text: delta.content })}\n\n`,
                  ),
                );
              }
              if (delta?.reasoning_content) {
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

        if (fullResponse) {
          await db.insert(messages).values({
            conversationId,
            role: "assistant",
            content: fullResponse,
          });

          // 回复成功才扣积分（失败/空回复不扣；管理员免费）
          if (userId && chargeCredits) {
            await consumeCredits(
              userId,
              CREDIT_PER_CHAT,
              `对话: ${message.slice(0, 50)}`,
            );
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
        );
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "未知错误";
        console.error("Chat stream error:", msg);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", text: `对话出错: ${msg}` })}\n\n`,
          ),
        );
        controller.close();
      }
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
