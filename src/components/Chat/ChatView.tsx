"use client";

import { useState, useRef, useEffect } from "react";
import ChatInput from "./ChatInput";
import type { Message } from "@/types";

interface ChatViewProps {
  conversationId: string;
  messages: Message[];
  streaming: boolean;
  streamingText: string;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatView({
  messages,
  streaming,
  streamingText,
  onSend,
  onStop,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<number>>(
    new Set(),
  );
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  function toggleReasoning(idx: number) {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handleCopy(idx: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function handleRegenerate() {
    if (streaming) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        onSend(messages[i].content);
        return;
      }
    }
  }

  return (
    <div className="dr-canvas flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="text-center mt-24 animate-fade-up px-6">
              <p
                className="font-display text-5xl mb-4 select-none"
                style={{ color: "var(--accent)", opacity: 0.85 }}
              >
                焙
              </p>
              <p
                className="font-display text-xl mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                慢火，把想法焙透
              </p>
              <p
                className="text-sm max-w-sm mx-auto leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                在下方输入，Enter 发送。深度思考会慢一点——值得等。
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const hasReasoning = !!m.reasoning;
            const reasoningOpen = expandedReasoning.has(i);
            // 慢焙蒸汽升腾：每条消息 staggered 出现，索引越大延迟越长（最多 0.4s）
            const msgDelay = Math.min(i * 0.06, 0.4);

            return (
              <div
                key={m.id || i}
                className={`flex ${isUser ? "justify-end" : "justify-start"} animate-steam-rise`}
                style={{ animationDelay: `${msgDelay}s` }}
              >
                {/* 气泡按内容宽度收缩，最长不超过 78%；短句不再拉满整行 */}
                <div
                  className={`flex flex-col max-w-[78%] min-w-0 group ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  {hasReasoning && (
                    <div className="mb-1.5 w-full max-w-full">
                      <button
                        onClick={() => toggleReasoning(i)}
                        className="flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-150 mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`transition-transform duration-200 ${
                            reasoningOpen ? "rotate-90" : ""
                          }`}
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        思考过程
                      </button>
                      {reasoningOpen && (
                        <div
                          className="rounded-lg px-3 py-2 text-[12px] leading-relaxed animate-fade-in border w-full"
                          style={{
                            background: "var(--bg-root)",
                            borderColor: "var(--border)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {m.reasoning}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`w-fit max-w-full rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isUser ? "rounded-br-md" : "rounded-bl-md"
                    }`}
                    style={
                      isUser
                        ? {
                            background: "var(--accent)",
                            color: "var(--accent-on)",
                            boxShadow: "var(--shadow-sm)",
                          }
                        : {
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                            boxShadow: "var(--shadow-sm)",
                          }
                    }
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  </div>

                  {!isUser && !streaming && (
                    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => handleCopy(i, m.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all active:scale-95"
                        style={{
                          color: "var(--text-muted)",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {copiedIdx === i ? "已复制" : "复制"}
                      </button>
                      {i === messages.length - 1 && (
                        <button
                          onClick={handleRegenerate}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all active:scale-95"
                          style={{
                            color: "var(--text-muted)",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          重新生成
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {streaming && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[78%] min-w-0 flex flex-col items-start">
                <div
                  className="w-fit max-w-full rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border:
                      "1px solid color-mix(in srgb, var(--accent) 28%, var(--border))",
                    boxShadow: "0 0 0 1px var(--accent-glow)",
                  }}
                >
                  <span className="whitespace-pre-wrap break-words">
                    {streamingText}
                  </span>
                  <span
                    className="inline-block w-1.5 h-4 ml-0.5 align-middle rounded-sm animate-pulse-soft"
                    style={{ background: "var(--accent)" }}
                  />
                </div>
              </div>
            </div>
          )}

          {streaming && !streamingText && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl px-5 py-3"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="flex gap-1.5">
                  {[0, 120, 240].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
                      style={{
                        background: "var(--accent)",
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput onSend={onSend} onStop={onStop} disabled={streaming} />
    </div>
  );
}
