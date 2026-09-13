"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson, jsonBody } from "@/lib/client-api";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";
import type { Conversation, Message } from "@/types";
import { CREDIT_PER_CHAT } from "@/types";
import { detectAssistantAppearanceIntent } from "@/lib/conversational-image-intent";

// Image chat shares the server's 300s image timeout. Keep the browser window
// slightly longer so it does not cancel an operation that is still valid.
const CHAT_REQUEST_TIMEOUT_MS = 310_000;

export function useChatActions(
  loadConversations: () => Promise<void>,
  loadCredits: () => Promise<void>,
) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [requests] = useState(createClientSessionLifecycle);

  const {
    userSessionVersion,
    config,
    setConversations,
    setActiveConvId,
    setChatMessages,
    setStreaming,
    setStreamingText,
    setWalletOpen,
    resetChatSession,
  } = useDeepRoastStore();

  useEffect(() => {
    requests.activate();
    const unsubscribe = useDeepRoastStore.subscribe((state, previous) => {
      if (state.userSessionVersion !== previous.userSessionVersion) {
        requests.invalidate();
      } else if (
        state.activeConvId !== previous.activeConvId ||
        state.chatSessionVersion !== previous.chatSessionVersion
      ) {
        requests.cancel("history");
        requests.cancel("chat");
        requests.cancel("selection");
      }
    });
    return () => {
      const ownsChat = requests.hasCurrent("chat");
      unsubscribe();
      requests.dispose();
      if (ownsChat) {
        setStreaming(false);
        setStreamingText("");
      }
    };
  }, [requests, setStreaming, setStreamingText]);

  const handleNewConversation = useCallback(async () => {
    if (!requests.isActive(userSessionVersion)) return;
    const textModelAvailable =
      config.enabledTextModels === undefined
        ? Boolean(config.textModel)
        : Boolean(
            config.textModel &&
              config.enabledTextModels.includes(config.textModel),
          );
    if (!textModelAvailable) {
      toast("管理员暂未启用对话模型", "error");
      return;
    }
    const request = requests.start("selection", userSessionVersion);
    if (!request) return;
    try {
      const conv = await apiJson<Conversation>("/api/conversations", {
        method: "POST",
        ...jsonBody({ model: config.textModel }),
        signal: request.signal,
      });
      if (!request.isCurrent()) return;
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      resetChatSession();
    } catch {
      if (request.isCurrent()) toast("创建对话失败", "error");
    } finally {
      request.finish();
    }
  }, [
    requests,
    userSessionVersion,
    config.textModel,
    config.enabledTextModels,
    setConversations,
    setActiveConvId,
    resetChatSession,
    toast,
  ]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (!requests.isActive(userSessionVersion)) return;
      setActiveConvId(id);
      resetChatSession();
      const request = requests.start("history", userSessionVersion);
      if (!request) return;
      const view = useDeepRoastStore.getState().chatSessionVersion;
      const isCurrent = () => {
        const state = useDeepRoastStore.getState();
        return request.isCurrent() && state.activeConvId === id && state.chatSessionVersion === view;
      };
      try {
        const data = await apiJson<{ messages?: Message[] }>(
          `/api/conversations/${id}`,
          { signal: request.signal },
        );
        if (isCurrent()) setChatMessages(data.messages || []);
      } catch {
        if (isCurrent()) toast("加载对话失败", "error");
      } finally {
        request.finish();
      }
    },
    [requests, userSessionVersion, setActiveConvId, resetChatSession, setChatMessages, toast],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const request = requests.start(`delete:${id}`, userSessionVersion);
      if (!request) return;
      try {
        await apiJson(`/api/conversations/${id}`, { method: "DELETE", signal: request.signal });
        if (!request.isCurrent()) return;
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (useDeepRoastStore.getState().activeConvId === id) {
          setActiveConvId(null);
          resetChatSession();
        }
        toast("对话已删除", "success");
      } catch {
        if (request.isCurrent()) toast("删除失败", "error");
      } finally {
        request.finish();
      }
    },
    [requests, userSessionVersion, setConversations, setActiveConvId, resetChatSession, toast],
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      const request = requests.start(`rename:${id}`, userSessionVersion);
      if (!request) return;
      try {
        await apiJson(`/api/conversations/${id}`, {
          method: "PATCH",
          ...jsonBody({ title }),
          signal: request.signal,
        });
        if (!request.isCurrent()) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title } : c)),
        );
        toast("已重命名", "success");
      } catch {
        if (request.isCurrent()) toast("重命名失败", "error");
      } finally {
        request.finish();
      }
    },
    [requests, userSessionVersion, setConversations, toast],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!requests.isActive(userSessionVersion)) return;
      const { activeConvId: convId, chatSessionVersion: view, streaming: isStreaming, credits } =
        useDeepRoastStore.getState();
      if (!convId || isStreaming) return;
      const textModelAvailable =
        config.enabledTextModels === undefined
          ? Boolean(config.textModel)
          : Boolean(
              config.textModel &&
                config.enabledTextModels.includes(config.textModel),
            );
      if (!textModelAvailable) {
        toast("管理员暂未启用对话模型", "error");
        return;
      }

      // 助手形象生图由服务端识别；客户端预检仍先保证普通对话可用。
      const appearanceIntent = detectAssistantAppearanceIntent(text);
      const role = user?.role || "user";
      if (role !== "admin" && !appearanceIntent && credits < CREDIT_PER_CHAT) {
        toast("积分不足，每条对话消耗 2 积分，请先签到或联系管理员", "error");
        setWalletOpen(true);
        return;
      }

      const request = requests.start("chat", userSessionVersion);
      if (!request) return;
      // A snapshot requested before this send must not erase the optimistic message.
      requests.cancel("history");
      const isCurrent = () => {
        const state = useDeepRoastStore.getState();
        return request.isCurrent() && state.activeConvId === convId && state.chatSessionVersion === view;
      };
      const userMsg: Message = { role: "user", content: text };
      setChatMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamingText("");

      const abort: AbortController = request;
      let timedOut = false;
      let streamErrorHandled = false;
      let imageMessageStarted = false;
      let imageMessageCompleted = false;
      let full = "";
      let reasoning = "";
      const timeoutId = setTimeout(() => {
        if (!isCurrent()) return;
        timedOut = true;
        abort.abort();
      }, CHAT_REQUEST_TIMEOUT_MS);

      const appendAssistantError = (message: string) => {
        if (!isCurrent()) return;
        streamErrorHandled = true;
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: `✗ ${message}` },
        ]);
      };

      const replacePendingImage = (message: Message) => {
        if (!isCurrent()) return;
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
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ conversationId: convId, message: text }),
          signal: abort.signal,
        });

        if (!isCurrent()) return;
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          let errorMessage = `请求失败 (${res.status})`;
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (!isCurrent()) return;
            errorMessage = data.error || errorMessage;
            if (data.code === "INSUFFICIENT_CREDITS") setWalletOpen(true);
          }
          throw new Error(errorMessage);
        }
        if (ct.includes("application/json")) {
          const data = await res.json();
          if (!isCurrent()) return;
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
          if (!isCurrent()) return;
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
          if (!isCurrent()) return;
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
        if (!isCurrent()) return;
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
        if (isCurrent()) {
          setStreaming(false);
          setStreamingText("");
        }
        request.finish();
      }
    },
    [
      requests,
      userSessionVersion,
      setChatMessages,
      setStreaming,
      setStreamingText,
      setWalletOpen,
      loadConversations,
      loadCredits,
      toast,
      user?.role,
      config.textModel,
      config.enabledTextModels,
    ],
  );

  const handleStopChat = useCallback(() => {
    if (!requests.isActive(userSessionVersion)) return;
    requests.cancel("chat");
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
  }, [requests, userSessionVersion, setChatMessages, setStreaming, setStreamingText]);

  return {
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleSendMessage,
    handleStopChat,
  };
}
