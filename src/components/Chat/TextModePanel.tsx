"use client";

import Sidebar from "@/components/Sidebar";
import ChatView from "@/components/Chat/ChatView";
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
  modelAvailable: boolean;
  sidebarOpen?: boolean;
  onSidebarClose?: () => void;
  /** 手机端：对话侧栏顶部返回文生图 */
  onSwitchImage?: () => void;
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
  modelAvailable,
  sidebarOpen = false,
  onSidebarClose,
  onSwitchImage,
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
        open={sidebarOpen}
        onClose={onSidebarClose}
        onSwitchImage={onSwitchImage}
      />

      {activeConvId ? (
        <ChatView
          conversationId={activeConvId}
          messages={chatMessages}
          streaming={streaming}
          streamingText={streamingText}
          onSend={onSend}
          onStop={onStop}
          modelAvailable={modelAvailable}
        />
      ) : (
        <div className="dr-canvas flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 animate-fade-up max-w-md px-6">
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
                className="text-xs mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                {modelAvailable
                  ? "在左侧点「新对话」开始"
                  : "管理员暂未启用对话模型"}
              </p>
              <button
                onClick={onNew}
                disabled={!modelAvailable}
                className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 hover:scale-[1.02]"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-on)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                开始新对话
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
