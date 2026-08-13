"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CREDIT_PER_CHAT } from "@/types";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, onStop, disabled }: ChatInputProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  function handleSend() {
    const text = input.trim();
    if (!text || disabled) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  const canSend = !!input.trim() && !disabled;

  return (
    <div
      className="border-t p-3 pb-4"
      style={{
        background:
          "color-mix(in srgb, var(--bg-canvas) 70%, var(--bg-surface))",
        borderColor: "var(--border-strong)",
      }}
    >
      <div
        className="max-w-3xl mx-auto flex gap-2.5 items-end rounded-2xl p-1.5 pl-2"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息… Enter 发送 · Shift+Enter 换行"
          rows={1}
          disabled={disabled}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm resize-none transition-all duration-200 disabled:opacity-40 outline-none bg-transparent"
          style={{
            color: "var(--text-primary)",
            border: "none",
          }}
        />

        {disabled ? (
          <button
            onClick={onStop}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 shrink-0 active:scale-95"
            style={{
              background: "var(--danger-surface)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
            }}
          >
            停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 shrink-0 active:scale-95 disabled:opacity-35 disabled:scale-100"
            style={{
              background: canSend ? "var(--accent)" : "var(--bg-elevated)",
              color: canSend ? "var(--accent-on)" : "var(--text-muted)",
              border: canSend
                ? "1px solid transparent"
                : "1px solid var(--border)",
            }}
          >
            发送
          </button>
        )}
      </div>
      <p
        className="max-w-3xl mx-auto mt-1.5 px-1 text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        {user?.role === "admin"
          ? "管理员免费 · 每条消耗 0 积分"
          : `每条回复消耗 ${CREDIT_PER_CHAT} 积分（回复成功才扣，失败不扣）`}
      </p>
    </div>
  );
}
