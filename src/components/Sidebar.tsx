"use client";

import { useState } from "react";
import { relativeTime } from "@/types";
import type { Conversation } from "@/types";
import ConfirmDialog from "@/components/ConfirmDialog";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** 移动端抽屉开关（md 以上忽略） */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  open = false,
  onClose,
}: SidebarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState("");
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`w-64 shrink-0 border-r flex flex-col h-full fixed md:static inset-y-0 left-0 z-40 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          background: "var(--bg-sidebar)",
          borderColor: "var(--border-strong)",
        }}
      >
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full rounded-lg py-2.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98]"
          style={{
            background: "var(--accent)",
            color: "var(--accent-on)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          + 新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {conversations.length === 0 && (
          <div className="text-center mt-12 px-4">
            <p
              className="font-display text-2xl mb-2 opacity-40"
              style={{ color: "var(--accent)" }}
            >
              焙
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              还没有对话。点上方开始一炉新的思考。
            </p>
          </div>
        )}

        {conversations.map((conv) => {
          const isActive = activeId === conv.id;
          return (
            <div
              key={conv.id}
              onClick={() => {
                onSelect(conv.id);
                onClose?.();
              }}
              className="group relative pl-3 pr-2 py-2.5 rounded-lg cursor-pointer transition-all duration-150"
              style={{
                background: isActive ? "var(--bg-elevated)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
              }}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium leading-tight">
                  {conv.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(conv.id);
                    setPendingDeleteTitle(conv.title);
                    setConfirmOpen(true);
                  }}
                  className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 text-xs"
                  style={{
                    color: "var(--danger)",
                    background: "var(--danger-surface)",
                  }}
                  title="删除"
                  aria-label={`删除对话 ${conv.title}`}
                >
                  ✕
                </button>
              </div>
              <div
                className="text-[10px] mt-1 flex items-center gap-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <span className="truncate max-w-[7rem]">{conv.model}</span>
                <span>·</span>
                <span>{relativeTime(conv.updatedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
      </aside>
      <ConfirmDialog
        open={confirmOpen}
        title="删除对话"
        message={`确定删除对话「${pendingDeleteTitle}」？此操作不可撤销。`}
        confirmText="删除"
        onConfirm={() => {
          if (pendingDeleteId) onDelete(pendingDeleteId);
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
