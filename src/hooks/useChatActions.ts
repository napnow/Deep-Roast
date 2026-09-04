"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson, jsonBody } from "@/lib/client-api";
import type { Conversation, Message } from "@/types";
import { CREDIT_PER_CHAT } from "@/types";
import { detectAssistantAppearanceIntent } from "@/lib/conversational-image-intent";

const CHAT_REQUEST_TIMEOUT_MS = 90_000;

export function useChatActions(
  loadConversations: () => Promise<void>,
  loadCredits: () => Promise<void>,
) {
  const { toast } = useToast();
  const { user } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const {
    config,
    setConversations,
    setActiveConvId,
    setChatMessages,
    setStreaming,
    setStreamingText,
    setWalletOpen,
    resetChatSession,
  } = useDeepRoastStore();

  const handleNewConversation = useCallback(async () => {
    try {
      const conv = await apiJson<Conversation>("/api/conversations", {
        method: "POST",
        ...jsonBody({ model: config.textModel }),
      });
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      resetChatSession();
    } catch {
      toast("创建对话失败", "error");
    }
  }, [
    config.textModel,
    setConversations,
    setActiveConvId,
    resetChatSession,
    toast,
  ]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      setActiveConvId(id);
      resetChatSession();
      try {
        const data = await apiJson<{ messages?: Message[] }>(
          `/api/conversations/${id}`,
        );
        setChatMessages(data.messages || []);
      } catch {
        toast("加载对话失败", "error");
      }
    },
    [setActiveConvId, resetChatSession, setChatMessages, toast],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiJson(`/api/conversations/${id}`, { method: "DELETE" });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (useDeepRoastStore.getState().activeConvId === id) {
          setActiveConvId(null);
          resetChatSession();
        }
        toast("对话已删除", "success");
      } catch {
        toast("删除失败", "error");
      }
    },
    [setConversations, setActiveConvId, resetChatSession, toast],
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await apiJson(`/api/conversations/${id}`, {
          method: "PATCH",
          ...jsonBody({ title }),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title } : c)),
        );
        toast("已重命名", "success");
      } catch {
        toast("重命名失败", "error");
      }
    },
    [setConversations, toast],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      const { activeConvId: convId, streaming: isStreaming, credits } =
        useDeepRoastStore.getState();
      if (!convId || isStreaming) return;

      // 助手形象生图由服务端识别；客户端预检仍先保证普通对话可用。
      const appearanceIntent = detectAssistantAppearanceIntent(text);
      const role = user?.role || "user";
      if (role !== "admin" && !appearanceIntent && credits < CREDIT_PER_CHAT) {
        toast("积分不足，每条对话消耗 2 积分，请先签到或联系管理员", "error");
        setWalletOpen(true);
        return;
      }

      const userMsg: Message = { role: "user", content: text };
      setChatMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamingText("");

      const abort = new AbortController();
      let timedOut = false;
      let streamErrorHandled = false;
      let imageMessageStarted = false;
      let imageMessageCompleted = false;
      let full = "";
      let reasoning = "";
      const timeoutId = setTimeout(() => {
        timedOut = true;
        abort.abort();
      }, CHAT_REQUEST_TIMEOUT_MS);
      abortRef.current = abort;

      const appendAssistantError = (message: string) => {
        streamErrorHandled = true;
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: `✗ ${message}` },
        ]);
      };

      const replacePendingImage = (message: Message) => {
        setChatMessages((prev) => {
          const index = [...prev]
            .reverse()
            .findIndex(
              (item) => item.metadata?.image?.status === "pending",
            );
          if (index < 0) return [...prev, message];
          const actualIndex = prev.length - 1 - index;
          return prev.map((item, itemIndex) =>
            itemIndex === actualIndex ? message : item,
          );
        });
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, message: text }),
          signal: abort.signal,
        });

        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          let errorMessage = `请求失败 (${res.status})`;
          if (ct.includes("application/json")) {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
            if (data.code === "INSUFFICIENT_CREDITS") setWalletOpen(true);
          }
          throw new Error(errorMessage);
        }
        if (ct.includes("application/json")) {
          const data = await res.json();
          throw new Error(data.error || "接口返回了无效响应");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("接口没有返回内容");
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (evt: {
          type?: string;
          text?: string;
          prompt?: string;
          message?: Message;
        }) => {
          if (evt.type === "image_started") {
            imageMessageStarted = true;
            setChatMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "正在生成你的形象…",
                metadata: {
                  image: {
                    status: "pending",
                    prompt: evt.prompt || text,
                  },
                },
              },
            ]);
          } else if (evt.type === "image_done" && evt.message) {
            imageMessageCompleted = true;
            replacePendingImage(evt.message);
          } else if (evt.type === "image_error" && evt.message) {
            streamErrorHandled = true;
            replacePendingImage(evt.message);
          } else if (evt.type === "token") {
            full += evt.text || "";
            setStreamingText(full);
          } else if (evt.type === "reasoning") {
            reasoning += evt.text || "";
          } else if (evt.type === "error") {
            appendAssistantError(evt.text || "网络错误");
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), {
            stream: !done,
          });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              handleEvent(JSON.parse(line.slice(6)));
            } catch {
              /* ignore malformed SSE chunks */
            }
          }
          if (done) break;
        }

        if (!imageMessageStarted && !streamErrorHandled && full) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: full,
              reasoning: reasoning || undefined,
            },
          ]);
        }
        if (imageMessageStarted && !imageMessageCompleted && !streamErrorHandled) {
          replacePendingImage({
            role: "assistant",
            content: "这次没能生成出来。",
            metadata: {
              image: {
                status: "error",
                prompt: text,
                error: "服务响应不完整，请重试",
              },
            },
          });
        }
        if (!imageMessageStarted && !full && !streamErrorHandled) {
          appendAssistantError("服务响应不完整，请重试");
        }
        loadConversations();
        loadCredits();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError" && !timedOut) {
          return;
        }
        if (!streamErrorHandled) {
          const errorMessage = timedOut
            ? "请求超时，请检查 API 设置后重试"
            : "网络错误，请稍后重试";
          if (imageMessageStarted) {
            replacePendingImage({
              role: "assistant",
              content: "这次没能生成出来。",
              metadata: {
                image: {
                  status: "error",
                  prompt: text,
                  error: errorMessage,
                },
              },
            });
            streamErrorHandled = true;
          } else {
            appendAssistantError(errorMessage);
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === abort) abortRef.current = null;
        setStreaming(false);
        setStreamingText("");
      }
    },
    [
      setChatMessages,
      setStreaming,
      setStreamingText,
      setWalletOpen,
      loadConversations,
      loadCredits,
      toast,
      user?.role,
    ],
  );

  const handleStopChat = useCallback(() => {
    abortRef.current?.abort();
    setChatMessages((prev) =>
      prev.map((message) =>
        message.metadata?.image?.status === "pending"
          ? {
              ...message,
              content: "这次生成已停止。",
              metadata: {
                image: {
                  ...message.metadata.image,
                  status: "error",
                  error: "已停止生成，可点击重试",
                },
              },
            }
          : message,
      ),
    );
    setStreaming(false);
    setStreamingText("");
  }, [setChatMessages, setStreaming, setStreamingText]);

  return {
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleSendMessage,
    handleStopChat,
  };
}
