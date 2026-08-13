"use client";

import { useCallback, useState } from "react";
import Header from "@/components/Header";
import TextModePanel from "@/components/Chat/TextModePanel";
import ImageGenView from "@/components/ImageGen/ImageGenView";
import MobileDrawer from "@/components/ImageGen/MobileDrawer";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { useAppActions } from "@/hooks/useAppActions";
import { ApiError, apiJson } from "@/lib/client-api";
import { CHECKIN_REWARD, type ImageRecord } from "@/types";

/**
 * 首页只负责布局拼装；状态在 store，业务在 useAppActions。
 * 两种模式：文生图 / 对话。配置类操作仅管理员可用。
 */
export default function Home() {
  const { user, logout } = useAuth();
  const actions = useAppActions();
  const { toast } = useToast();
  const [checkinLoading, setCheckinLoading] = useState(false);
  // 结果区当前展示的图片（与顶部菜单「生图记录」联动）
  const [activeImage, setActiveImage] = useState<ImageRecord | null>(null);
  // 手机端：文生图 Tab 与抽屉侧栏
  const [mobileTab, setMobileTab] = useState<
    "generate" | "gallery" | "announcements"
  >("generate");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 手机端：对话模式侧栏
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  const {
    activeMode,
    setActiveMode,
    config,
    imageModels,
    selectedImageModel,
    conversations,
    activeConvId,
    chatMessages,
    streaming,
    streamingText,
    imageHistory,
    generating,
    credits,
    checkinEligible,
    todayChecked,
    setCredits,
    setCheckinStatus,
    setSelectedImageModel,
    setSettingsOpen,
    setWalletOpen,
  } = useDeepRoastStore();

  const handleCheckin = useCallback(async () => {
    if (!checkinEligible || todayChecked || checkinLoading) return;
    setCheckinLoading(true);
    try {
      const data = await apiJson<{
        credits: number;
        reward?: number;
        todayChecked?: boolean;
      }>("/api/credits/checkin", { method: "POST" });
      setCredits(data.credits);
      setCheckinStatus({ todayChecked: true, eligible: true });
      toast(`签到成功，+${data.reward ?? CHECKIN_REWARD} 积分`, "success");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast(err.message || "签到失败", "error");
        if (err.message.includes("已签到")) {
          setCheckinStatus({ todayChecked: true });
        }
      } else {
        toast("网络错误", "error");
      }
    }
    setCheckinLoading(false);
  }, [
    checkinEligible,
    todayChecked,
    checkinLoading,
    setCredits,
    setCheckinStatus,
    toast,
  ]);

  const currentModel =
    selectedImageModel && config.enabledImageModels?.includes(selectedImageModel)
      ? selectedImageModel
      : config.imageModel;
  const modelOptions = config.enabledImageModels?.length
    ? config.enabledImageModels
    : imageModels.map((m) => m.id);
  const hasApiKey = !!config.hasApiKey;
  const role = user?.role || "user";
  const isAdmin = role === "admin";

  // 模型切换：仅允许在管理员启用的列表中切换
  const handleModelChange = useCallback(
    (model: string) => {
      if (config.enabledImageModels?.includes(model)) {
        setSelectedImageModel(model);
      }
    },
    [config.enabledImageModels, setSelectedImageModel],
  );

  // 删除图片时若正在结果区展示，同步清空
  const handleDeleteImage = useCallback(
    async (id: string) => {
      setActiveImage((prev) => (prev?.id === id ? null : prev));
      await actions.handleDeleteImage(id);
    },
    [actions, setActiveImage],
  );

  // 模式切换（桌面端顶栏 tab）
  const handleModeChange = useCallback(
    (mode: "image" | "chat") => {
      setActiveMode(mode);
      setDrawerOpen(false);
      setChatSidebarOpen(false);
    },
    [setActiveMode],
  );

  // 手机端汉堡：按模式区分——对话模式打开对话列表侧栏，文生图打开全局抽屉
  const handleMenuClick = useCallback(() => {
    if (activeMode === "chat") {
      setChatSidebarOpen(true);
    } else {
      setDrawerOpen(true);
    }
  }, [activeMode]);

  // 抽屉点「文生图/图库/公告」：切回文生图模式并选中对应子 Tab
  const handleSelectImageTab = useCallback(
    (tab: "generate" | "gallery" | "announcements") => {
      setActiveMode("image");
      setMobileTab(tab);
      setDrawerOpen(false);
      setChatSidebarOpen(false);
    },
    [setActiveMode],
  );

  // 抽屉点「对话」：切到对话模式（对话列表由汉堡/侧栏返回按钮管理）
  const handleSwitchChat = useCallback(() => {
    setActiveMode("chat");
    setDrawerOpen(false);
  }, [setActiveMode]);

  // 对话侧栏顶部「← 文生图」：切回文生图模式
  const handleSwitchImage = useCallback(() => {
    setActiveMode("image");
    setChatSidebarOpen(false);
  }, [setActiveMode]);

  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--bg-root)",
        // svh：键盘弹出时高度不收缩，页面不跳动（dvh 会随键盘变化导致整体上顶）
        height: "100svh",
      }}
    >
      <Header
        activeMode={activeMode}
        onModeChange={handleModeChange}
        currentModel={currentModel}
        modelOptions={modelOptions}
        onModelChange={handleModelChange}
        onSettingsClick={() => setSettingsOpen(true)}
        username={user?.username || ""}
        role={role}
        onLogout={logout}
        credits={credits}
        checkinEligible={checkinEligible}
        todayChecked={todayChecked}
        checkinLoading={checkinLoading}
        onCheckinClick={handleCheckin}
        onWalletClick={() => setWalletOpen(true)}
        onMenuClick={handleMenuClick}
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
          {isAdmin
            ? "未配置 API Key — 点击右上角齿轮完成设置"
            : "生图服务暂未配置 — 请联系管理员"}
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {activeMode === "chat" ? (
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
            sidebarOpen={chatSidebarOpen}
            onSidebarClose={() => setChatSidebarOpen(false)}
            onSwitchImage={handleSwitchImage}
          />
        ) : (
          <ImageGenView
            model={currentModel}
            onGenerate={actions.handleGenerateImage}
            onEditImage={actions.handleEditImage}
            onEditImageBatch={actions.handleEditImageBatch}
            onStopGenerate={actions.handleStopGenerateImage}
            generating={generating}
            history={imageHistory}
            activeImage={activeImage}
            onActiveImageChange={setActiveImage}
            onDeleteImage={handleDeleteImage}
            credits={credits}
            isAdmin={isAdmin}
            checkinEligible={checkinEligible}
            todayChecked={todayChecked}
            onCheckinClick={handleCheckin}
            onWalletClick={() => setWalletOpen(true)}
            mobileTab={mobileTab}
          />
        )}
      </div>

      {/* 手机端全局抽屉：任何模式下汉堡可唤起，含文生图/对话全部入口 */}
      <MobileDrawer
        open={drawerOpen}
        activeMode={activeMode}
        tab={mobileTab}
        historyCount={imageHistory.length}
        chatCount={conversations.length}
        onSelectImageTab={handleSelectImageTab}
        onSwitchChat={handleSwitchChat}
        onClose={() => setDrawerOpen(false)}
      />

      <AppModals
        onSaveConfig={actions.handleSaveConfig}
        role={role}
        checkinLoading={checkinLoading}
        onCheckinClick={handleCheckin}
      />
    </div>
  );
}
