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
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="admin-kicker">Archive</p>
          <h2 className="admin-title text-base mt-1">对话记录</h2>
        </div>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {conversations.length}
        </span>
      </div>

      {conversations.length === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] px-4 py-10 text-center text-xs"
          style={{
            background: "var(--bg-surface)",
            border: "1px dashed var(--border-strong)",
            color: "var(--text-muted)",
          }}
        >
          暂无对话
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const open = expandedConv === conv.id;
            return (
              <div
                key={conv.id}
                className="admin-card overflow-hidden transition-shadow duration-150"
                style={{
                  boxShadow: open ? "var(--shadow-md)" : "var(--shadow-sm)",
                  borderColor: open
                    ? "var(--border-strong)"
                    : "var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(conv.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors duration-100"
                  style={{
                    background: open
                      ? "color-mix(in srgb, var(--accent-surface) 55%, transparent)"
                      : "transparent",
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {conv.title}
                    </p>
                    <p
                      className="text-[10.5px] mt-1 tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {conv.model} · {conv.messageCount ?? 0} 条 ·{" "}
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
                    className={`transition-transform duration-200 shrink-0 ${
                      open ? "rotate-180" : ""
                    }`}
                    style={{ color: "var(--text-muted)" }}
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {open && convMessages.length > 0 && (
                  <div
                    className="px-4 pb-3.5 pt-2 space-y-2 border-t"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-root)",
                    }}
                  >
                    {convMessages.map((msg, i) => (
                      <div
                        key={msg.id || i}
                        className="text-xs rounded-[var(--radius-sm)] p-2.5"
                        style={{
                          background:
                            msg.role === "user"
                              ? "var(--accent-surface)"
                              : "var(--bg-surface)",
                          color:
                            msg.role === "user"
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span
                          className="text-[9.5px] font-bold uppercase tracking-[0.12em] mr-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {msg.role === "user"
                            ? "用户"
                            : msg.role === "system"
                              ? "系统"
                              : "AI"}
                        </span>
                        <span className="whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
