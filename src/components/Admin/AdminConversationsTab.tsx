"use client";

import type { Conversation, Message } from "@/types";
import { relativeTime } from "@/types";

interface AdminConversationsTabProps {
  conversations: Conversation[];
  expandedConv: string | null;
  convMessages: Message[];
  onToggle: (conversationId: string) => void;
}

export default function AdminConversationsTab({
  conversations,
  expandedConv,
  convMessages,
  onToggle,
}: AdminConversationsTabProps) {
  return (
    <section>
      <h2
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--text-secondary)" }}
      >
        对话记录 ({conversations.length})
      </h2>
      {conversations.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          暂无对话
        </p>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="rounded-xl border overflow-hidden"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <button
                onClick={() => onToggle(conv.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between transition-colors duration-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title}</p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {conv.model} · {conv.messageCount ?? 0} 条消息 ·{" "}
                    {relativeTime(conv.updatedAt || conv.createdAt)}
                  </p>
                </div>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform duration-200 ${expandedConv === conv.id ? "rotate-180" : ""}`}
                  style={{
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {expandedConv === conv.id && convMessages.length > 0 && (
                <div
                  className="px-4 pb-3 space-y-2 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  {convMessages.map((msg, i) => (
                    <div
                      key={msg.id || i}
                      className="text-xs rounded-lg p-2.5"
                      style={{
                        background:
                          msg.role === "user"
                            ? "var(--accent-surface)"
                            : "var(--bg-root)",
                        color:
                          msg.role === "user"
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider mr-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {msg.role === "user"
                          ? "用户"
                          : msg.role === "system"
                            ? "系统"
                            : "AI"}
                      </span>
                      <span className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
