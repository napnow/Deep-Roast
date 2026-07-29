"use client";

import Sidebar from "@/components/Sidebar";
import ChatView from "@/components/Chat/ChatView";
import { EXAMPLE_PROMPTS } from "@/types";
import type { Conversation, Message } from "@/types";

interface TextModePanelProps {
  conversations: Conversation[];
  activeConvId: string | null;
  chatMessages: Message[];
  streaming: boolean;
  streamingText: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onExamplePrompt: (text: string) => void;
}

export default function TextModePanel({
  conversations,
  activeConvId,
  chatMessages,
  streaming,
  streamingText,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onSend,
  onStop,
  onExamplePrompt,
}: TextModePanelProps) {
  return (
    <>
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onRename={onRename}
      />

      {activeConvId ? (
        <ChatView
          conversationId={activeConvId}
          messages={chatMessages}
          streaming={streaming}
          streamingText={streamingText}
          onSend={onSend}
          onStop={onStop}
        />
      ) : (
        <div className="dr-canvas flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 animate-fade-up max-w-md px-6">
            <div
              className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center font-display text-2xl font-semibold"
              style={{
                background:
                  "linear-gradient(145deg, var(--accent-soft), var(--accent))",
                color: "var(--accent-on)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              焙
            </div>
            <div>
              <p
                className="font-display text-2xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                深焙
              </p>
              <p
                className="text-sm mt-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                深度思考，慢焙出好答案
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                左侧「新对话」，或点下面例子直接开炉
              </p>
            </div>

            <div className="grid gap-2">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onExamplePrompt(ex.text)}
                  className="flex items-center gap-2.5 text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 active:scale-[0.99]"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text-secondary)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <span className="text-base shrink-0 opacity-80">{ex.icon}</span>
                  <span className="truncate">{ex.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
