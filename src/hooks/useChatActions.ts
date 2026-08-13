"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson, jsonBody } from "@/lib/client-api";
import type { Conversation, Message } from "@/types";
import { CREDIT_PER_CHAT } from "@/types";

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

      // 积分预检（管理员免费）：余额不足直接拦截，不插入消息
      const role = user?.role || "user";
      if (role !== "admin" && credits < CREDIT_PER_CHAT) {
        toast("积分不足，每条对话消耗 2 积分，请先签到或联系管理员", "error");
        setWalletOpen(true);
        return;
      }

      const userMsg: Message = { role: "user", content: text };
      setChatMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamingText("");

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, message: text }),
          signal: abort.signal,
        });

        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const err = await res.json();
          // 失败时移除刚插入的用户消息（服务端也未入库，保持双方一致）
          setChatMessages((prev) => prev.filter((m) => m !== userMsg));
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: `✗ ${err.error}` },
          ]);
          setStreaming(false);
          if (err.code === "INSUFFICIENT_CREDITS") {
            setWalletOpen(true);
          }
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;
        const dec = new TextDecoder();
        let full = "";
        let reasoning = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "token") {
                full += evt.text;
                setStreamingText(full);
              } else if (evt.type === "reasoning") {
                reasoning += evt.text;
              } else if (evt.type === "done") {
                setChatMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: full,
                    reasoning: reasoning || undefined,
                  },
                ]);
                setStreamingText("");
                setStreaming(false);
                loadConversations();
                // 回复成功扣了积分，刷新余额显示
                loadCredits();
              } else if (evt.type === "error") {
                setChatMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: `✗ ${evt.text}` },
                ]);
                setStreamingText("");
                setStreaming(false);
              }
            } catch {
              /* skip malformed chunks */
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: "✗ 网络错误" },
          ]);
          setStreaming(false);
          setStreamingText("");
        }
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
    setStreaming(false);
    setStreamingText("");
  }, [setStreaming, setStreamingText]);

  return {
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleSendMessage,
    handleStopChat,
  };
}
