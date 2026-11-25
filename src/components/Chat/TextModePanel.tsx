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
            <div>
              <p
                className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                有什么想聊的？
              </p>
              <p
                className="text-sm mt-1.5 text-[var(--text-muted)]"
              >
                提问、改文案、聊聊画面构思都可以。
              </p>
              <p
                className="text-xs mt-2 text-[var(--text-muted)]"
              >
                {modelAvailable
                  ? "点击下方按钮，开始一段新的对话与构思"
                  : "管理员暂未启用对话模型"}
              </p>
              <button
                onClick={onNew}
                disabled={!modelAvailable}
                className="mt-5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-surface)",
                  boxShadow: "0 8px 20px -8px rgba(17,17,16,.45)",
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
