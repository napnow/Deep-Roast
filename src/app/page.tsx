"use client";

import Header from "@/components/Header";
import TextModePanel from "@/components/Chat/TextModePanel";
import ImageGenView from "@/components/ImageGen/ImageGenView";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import { useDeepRoastStore } from "@/lib/store";
import { useAppActions } from "@/hooks/useAppActions";

/**
 * 首页只负责布局拼装；状态在 store，业务在 useAppActions。
 */
export default function Home() {
  const { user, logout } = useAuth();
  const actions = useAppActions();

  const {
    activeMode,
    setActiveMode,
    config,
    textModels,
    imageModels,
    conversations,
    activeConvId,
    chatMessages,
    streaming,
    streamingText,
    imageHistory,
    generating,
    credits,
    setSettingsOpen,
    setRechargeOpen,
    setWalletOpen,
  } = useDeepRoastStore();

  // 文生文：有当前会话时显示会话绑定的模型（实际对话用的就是它）
  const activeConv =
    activeMode === "text" && activeConvId
      ? conversations.find((c) => c.id === activeConvId)
      : undefined;
  const currentModel =
    activeMode === "text"
      ? activeConv?.model || config.textModel
      : config.imageModel;
  // 当前模型若不在列表中（历史会话自定义 id），补进列表避免选中态丢失
  const baseModels = activeMode === "text" ? textModels : imageModels;
  const currentModels =
    currentModel && !baseModels.some((m) => m.id === currentModel)
      ? [{ id: currentModel }, ...baseModels]
      : baseModels;
  const hasApiKey = !!config.hasApiKey;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-root)" }}>
      <Header
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        currentModel={currentModel}
        models={currentModels}
        onModelChange={actions.handleModelChange}
        onModelRemove={actions.handleModelRemove}
        onSettingsClick={() => setSettingsOpen(true)}
        username={user?.username || ""}
        role={user?.role || "user"}
        onLogout={logout}
        credits={credits}
        onRechargeClick={() => setRechargeOpen(true)}
        onWalletClick={() => setWalletOpen(true)}
      />

      {!hasApiKey && (
        <div
          className="border-b px-6 py-2 text-center text-xs font-medium"
          style={{
            background: "var(--accent-surface)",
            borderColor: "var(--border-strong)",
            color: "var(--accent)",
          }}
        >
          未配置 API Key — 点击右上角齿轮完成设置
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {activeMode === "text" ? (
          <TextModePanel
            conversations={conversations}
            activeConvId={activeConvId}
            chatMessages={chatMessages}
            streaming={streaming}
            streamingText={streamingText}
            onSelect={actions.handleSelectConversation}
            onNew={actions.handleNewConversation}
            onDelete={actions.handleDeleteConversation}
            onRename={actions.handleRenameConversation}
            onSend={actions.handleSendMessage}
            onStop={actions.handleStopChat}
            onExamplePrompt={actions.handleExamplePrompt}
          />
        ) : (
          <ImageGenView
            model={config.imageModel}
            onGenerate={actions.handleGenerateImage}
            onStopGenerate={actions.handleStopGenerateImage}
            generating={generating}
            history={imageHistory}
            onDeleteImage={actions.handleDeleteImage}
            credits={credits}
            onRechargeClick={() => setRechargeOpen(true)}
          />
        )}
      </div>

      <AppModals onSaveConfig={actions.handleSaveConfig} />
    </div>
  );
}
