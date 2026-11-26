"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import TextModePanel from "@/components/Chat/TextModePanel";
import AnnouncementTab from "@/components/ImageGen/AnnouncementTab";
import MobileDrawer from "@/components/ImageGen/MobileDrawer";
import { useToast } from "@/components/Toast";
import AppShell from "@/components/Workspace/AppShell";
import MobileWorkspaceNav from "@/components/Workspace/MobileWorkspaceNav";
import {
  getMobilePrimaryWorkspace,
  type MobileImageTab,
  type MobilePrimaryWorkspace,
} from "@/components/Workspace/mobile-workspace-ui";
import { useAppActions } from "@/hooks/useAppActions";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { ApiError, apiJson } from "@/lib/client-api";
import { softNavigate } from "@/lib/nav-transition";
import { useDeepRoastStore } from "@/lib/store";
import {
  parseStoredBoolean,
  parseStoredWorkspaceMode,
  type WorkspaceMode,
} from "@/lib/workspace-preferences";
import { isLocalMobilePreview } from "@/lib/local-preview";
import RedesignTopbar, { type RedesignNav } from "@/components/Redesign/RedesignTopbar";
import RedesignStudio from "@/components/Redesign/RedesignStudio";
import type { RedesignView } from "@/components/Redesign/redesign-ui";

const WORKSPACE_STORAGE_KEY = "deep-roast-workspace";
const INSPECTOR_COLLAPSED_STORAGE_KEY =
  "deep-roast-inspector-collapsed";

/** 首页只负责工作区布局；状态在 store，业务在 useAppActions。 */
export default function Home() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const actions = useAppActions();
  const { toast } = useToast();
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileImageTab>("generate");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const [rdView, setRdView] = useState<RedesignView>("create");
  const mobileViewport = useMobileViewport();

  // The existing development-only preview identity gets an isolated demo image.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || user?.id !== "local-mobile-preview") return;
    const store = useDeepRoastStore.getState();
    store.setImageHistory([{
      id: "studio-preview-sample",
      prompt: "手作陶杯与深焙咖啡，温暖的晨光，静物摄影",
      model: "gpt-image-2",
      imageUrl: "/studio-preview-sample.png",
      size: "1536x1024",
      createdAt: "2026-11-01T08:00:00.000Z",
      sourceMode: "text",
    }]);
    store.setActiveImageId("studio-preview-sample");
  }, [user?.id]);

  const {
    activeMode,
    setActiveMode,
    setInspectorCollapsed,
    activeImageId,
    setActiveImageId,
    config,
    selectedImageModel,
    conversations,
    activeConvId,
    chatMessages,
    streaming,
    streamingText,
    imageHistory,
    imageHistoryHasMore,
    loadingMoreImages,
    generating,
    credits,
    checkinReward,
    checkinEligible,
    todayChecked,
    setCredits,
    setCheckinStatus,
    setWalletOpen,
    setPwOpen,
    setApiOpen,
    setSettingsOpen,
  } = useDeepRoastStore(
    useShallow((state) => ({
      activeMode: state.activeMode,
      setActiveMode: state.setActiveMode,
      setInspectorCollapsed: state.setInspectorCollapsed,
      activeImageId: state.activeImageId,
      setActiveImageId: state.setActiveImageId,
      config: state.config,
      selectedImageModel: state.selectedImageModel,
      conversations: state.conversations,
      activeConvId: state.activeConvId,
      chatMessages: state.chatMessages,
      streaming: state.streaming,
      streamingText: state.streamingText,
      imageHistory: state.imageHistory,
      imageHistoryHasMore: state.imageHistoryHasMore,
      loadingMoreImages: state.loadingMoreImages,
      generating: state.generating,
      credits: state.credits,
      checkinReward: state.checkinReward,
      checkinEligible: state.checkinEligible,
      todayChecked: state.todayChecked,
      setCredits: state.setCredits,
      setCheckinStatus: state.setCheckinStatus,
      setWalletOpen: state.setWalletOpen,
      setPwOpen: state.setPwOpen,
      setApiOpen: state.setApiOpen,
      setSettingsOpen: state.setSettingsOpen,
    })),
  );

  useEffect(() => {
    if (isLocalMobilePreview(window.location.search, process.env.NODE_ENV)) return;
    let cancelled = false;
    apiJson<{ enabled?: boolean }>("/api/public/donation")
      .then((data) => {
        if (!cancelled) setDonationEnabled(data.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setDonationEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveMode(
      parseStoredWorkspaceMode(
        window.localStorage.getItem(WORKSPACE_STORAGE_KEY),
      ),
    );
    setInspectorCollapsed(
      parseStoredBoolean(
        window.localStorage.getItem(INSPECTOR_COLLAPSED_STORAGE_KEY),
        false,
      ),
    );

    return useDeepRoastStore.subscribe((state, previousState) => {
      if (state.activeMode !== previousState.activeMode) {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, state.activeMode);
      }
      if (state.inspectorCollapsed !== previousState.inspectorCollapsed) {
        window.localStorage.setItem(
          INSPECTOR_COLLAPSED_STORAGE_KEY,
          String(state.inspectorCollapsed),
        );
      }
    });
  }, [setActiveMode, setInspectorCollapsed]);

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
      const reward = data.reward ?? checkinReward;
      setCheckinStatus({
        todayChecked: true,
        eligible: true,
        reward,
      });
      toast(`签到成功，+${reward} 积分`, "success");
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        toast(error.message || "签到失败", "error");
        if (error.message.includes("已签到")) {
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
    checkinReward,
    setCredits,
    setCheckinStatus,
    toast,
  ]);

  const currentModel =
    selectedImageModel && config.enabledImageModels?.includes(selectedImageModel)
      ? selectedImageModel
      : config.imageModel;
  const textModelAvailable =
    config.enabledTextModels === undefined
      ? Boolean(config.textModel)
      : Boolean(
          config.textModel && config.enabledTextModels.includes(config.textModel),
        );
  const hasApiKey = Boolean(config.hasApiKey);
  const role = user?.role || "user";
  const isAdmin = role === "admin";
  const mobilePrimaryWorkspace = getMobilePrimaryWorkspace(
    activeMode,
    mobileTab,
  );

  const handleDeleteImage = useCallback(
    async (id: string) => {
      if (activeImageId === id) setActiveImageId(null);
      await actions.handleDeleteImage(id);
    },
    [actions, activeImageId, setActiveImageId],
  );

  const handleBatchDeleteImages = useCallback(
    async (ids: string[], mode: "selected" | "version-group") => {
      const deletedIds = await actions.handleBatchDeleteImages(ids, mode);
      if (activeImageId && deletedIds.includes(activeImageId)) setActiveImageId(null);
      return deletedIds;
    },
    [actions, activeImageId, setActiveImageId],
  );

  const handleModeChange = useCallback(
    (mode: WorkspaceMode) => {
      setActiveMode(mode);
      setDrawerOpen(false);
      setChatSidebarOpen(false);
    },
    [setActiveMode],
  );

  const handleMenuClick = useCallback(() => {
    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop && activeMode === "chat") {
      setChatSidebarOpen(true);
      return;
    }
    setDrawerOpen(true);
  }, [activeMode]);

  const handleSelectImageTab = useCallback(
    (tab: MobileImageTab) => {
      setActiveMode("image");
      setMobileTab(tab);
      setRdView(tab === "gallery" ? "gallery" : "create");
      setDrawerOpen(false);
      setChatSidebarOpen(false);
    },
    [setActiveMode],
  );

  const handleSwitchChat = useCallback(() => {
    setActiveMode("chat");
    setDrawerOpen(false);
    setChatSidebarOpen(false);
  }, [setActiveMode]);

  const handleSwitchImage = useCallback(() => {
    setActiveMode("image");
    setChatSidebarOpen(false);
  }, [setActiveMode]);

  const handleOpenChatHistory = useCallback(() => {
    setActiveMode("chat");
    setDrawerOpen(false);
    setChatSidebarOpen(true);
  }, [setActiveMode]);

  const handleOpenAdmin = useCallback(() => {
    softNavigate(router, "/admin");
  }, [router]);

  const handleSelectMobileWorkspace = useCallback(
    (workspace: MobilePrimaryWorkspace) => {
      if (workspace === "account") {
        setDrawerOpen(true);
        return;
      }
      if (workspace === "chat") {
        handleSwitchChat();
        return;
      }
      handleSelectImageTab(workspace);
    },
    [handleSelectImageTab, handleSwitchChat],
  );

  const handleRedesignNav = (nav: RedesignNav) => {
    if (nav === "canvas") {
      softNavigate(router, "/studio/canvas");
      return;
    }
    if (nav === "wear") {
      softNavigate(router, "/studio/wear");
      return;
    }
    if (nav === "chat") {
      handleModeChange("chat");
      return;
    }
    setMobileTab(nav === "gallery" ? "gallery" : "generate");
    setRdView(nav);
    handleModeChange("image");
  };

  // 从独立工作台（如穿搭工作台 / 画布）跳回时，按 ?nav= 打开对应标签并清除参数
  useEffect(() => {
    const url = new URL(window.location.href);
    const nav = url.searchParams.get("nav");
    if (nav !== "chat" && nav !== "gallery" && nav !== "create") return;
    handleRedesignNav(nav);
    url.searchParams.delete("nav");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <RedesignTopbar
      active={activeMode === "chat" ? "chat" : rdView}
      onSelect={handleRedesignNav}
      username={user?.username || ""}
      role={role}
      credits={credits}
      donationEnabled={donationEnabled}
      onOpenDonation={() => setDonationOpen(true)}
      onLogout={logout}
      onWalletClick={() => setWalletOpen(true)}
      checkinAvailable={checkinEligible && !todayChecked}
      checkinReward={checkinReward}
      checkinLoading={checkinLoading}
      onCheckin={handleCheckin}
      onMenuClick={handleMenuClick}
    />
  );

  return (
    <AppShell header={header}>
      <div className="workspace-content">
        {process.env.NODE_ENV === "development" && user?.id === "local-mobile-preview" ? (
          <div className="studio-preview-notice">本地界面预览 · 示例图片，不连接线上数据</div>
        ) : !hasApiKey ? (
          <div
            className="border-b px-6 py-2 text-center text-xs font-medium"
            style={{
              background: "var(--accent-surface)",
              borderColor: "var(--border-strong)",
              color: "var(--accent)",
            }}
          >
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="underline-offset-4 hover:underline"
              >
                未配置 API Key — 点击此处配置模型渠道与密钥 →
              </button>
            ) : (
              "生图服务暂未配置 — 请联系管理员"
            )}
          </div>
        ) : null}

        <div className="workspace-stage">
          <section
            className={`workspace-view ${
              activeMode === "image" ? "is-active" : ""
            }`}
            aria-label="生图工作区"
            aria-hidden={activeMode !== "image"}
            inert={activeMode !== "image"}
          >
            {mobileTab === "announcements" ? (
              <AnnouncementTab />
            ) : (
              <RedesignStudio
                view={rdView}
                model={currentModel}
                history={imageHistory}
                hasMore={imageHistoryHasMore}
                loadingMore={loadingMoreImages}
                onLoadMore={actions.loadMoreImageHistory}
                generating={generating}
                credits={credits}
                isAdmin={isAdmin}
                onGenerate={actions.handleGenerateImageBatch}
                onEditImage={actions.handleEditImage}
                onEditImageBatch={actions.handleEditImageBatch}
                onStopGenerate={actions.handleStopGenerateImage}
                onRetryGenerate={actions.handleRetryImageTask}
                onDeleteImage={handleDeleteImage}
                onBatchDeleteImages={handleBatchDeleteImages}
                onWalletClick={() => setWalletOpen(true)}
                onShowCreate={() => {
                  setMobileTab("generate");
                  setRdView("create");
                }}
              />
            )}
          </section>

          <section
            className={`workspace-view ${
              activeMode === "chat" ? "is-active" : ""
            }`}
            aria-label="对话工作区"
            aria-hidden={activeMode !== "chat"}
            inert={activeMode !== "chat"}
          >
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
              modelAvailable={textModelAvailable}
              sidebarOpen={chatSidebarOpen}
              onSidebarClose={() => setChatSidebarOpen(false)}
              onSwitchImage={handleSwitchImage}
            />
          </section>
        </div>

        <MobileWorkspaceNav
          activeWorkspace={mobilePrimaryWorkspace}
          onSelect={handleSelectMobileWorkspace}
          hidden={mobileViewport.keyboardOpen}
        />

        <MobileDrawer
          open={drawerOpen}
          checkinEligible={checkinEligible}
          todayChecked={todayChecked}
          checkinReward={checkinReward}
          checkinLoading={checkinLoading}
          donationEnabled={donationEnabled}
          onOpenWallet={() => setWalletOpen(true)}
          onOpenPassword={() => setPwOpen(true)}
          onOpenApiKeys={() => setApiOpen(true)}
          onOpenDonation={() => setDonationOpen(true)}
          onOpenAnnouncements={() => handleSelectImageTab("announcements")}
          onOpenChatHistory={handleOpenChatHistory}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAdmin={handleOpenAdmin}
          onCheckin={handleCheckin}
          onLogout={logout}
          onClose={() => setDrawerOpen(false)}
        />

        <AppModals
          onSaveConfig={actions.handleSaveConfig}
          role={role}
          donationOpen={donationOpen}
          onDonationClose={() => setDonationOpen(false)}
          checkinLoading={checkinLoading}
          onCheckinClick={handleCheckin}
        />
      </div>
    </AppShell>
  );
}
