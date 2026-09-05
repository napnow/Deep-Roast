"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import TextModePanel from "@/components/Chat/TextModePanel";
import Header from "@/components/Header";
import ImageGenView from "@/components/ImageGen/ImageGenView";
import MobileDrawer from "@/components/ImageGen/MobileDrawer";
import { useToast } from "@/components/Toast";
import AppShell from "@/components/Workspace/AppShell";
import MobileWorkspaceNav from "@/components/Workspace/MobileWorkspaceNav";
import {
  getMobilePrimaryWorkspace,
  getMobileWorkspaceTitle,
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
import { type ImageRecord } from "@/types";

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
  const mobileViewport = useMobileViewport();

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
  } = useDeepRoastStore();

  useEffect(() => {
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
  const activeImage = activeImageId
    ? imageHistory.find((image) => image.id === activeImageId) ?? null
    : null;
  const hasApiKey = Boolean(config.hasApiKey);
  const role = user?.role || "user";
  const isAdmin = role === "admin";
  const mobilePrimaryWorkspace = getMobilePrimaryWorkspace(
    activeMode,
    mobileTab,
  );
  const mobileWorkspaceTitle = getMobileWorkspaceTitle(activeMode, mobileTab);

  const handleActiveImageChange = useCallback(
    (image: ImageRecord | null) => {
      setActiveImageId(image?.id ?? null);
    },
    [setActiveImageId],
  );

  const handleDeleteImage = useCallback(
    async (id: string) => {
      if (activeImageId === id) setActiveImageId(null);
      await actions.handleDeleteImage(id);
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

  const header = (
    <Header
      activeMode={activeMode}
      onModeChange={handleModeChange}
      username={user?.username || ""}
      role={role}
      onLogout={logout}
      credits={credits}
      donationEnabled={donationEnabled}
      onDonationClick={() => setDonationOpen(true)}
      onWalletClick={() => setWalletOpen(true)}
      onMenuClick={handleMenuClick}
      mobileTitle={mobileWorkspaceTitle}
    />
  );

  return (
    <AppShell header={header}>
      <div className="workspace-content">
        {!hasApiKey ? (
          <div
            className="border-b px-6 py-2 text-center text-xs font-medium"
            style={{
              background: "var(--accent-surface)",
              borderColor: "var(--border-strong)",
              color: "var(--accent)",
            }}
          >
            {isAdmin
              ? "未配置 API Key — 请从管理控制台完成设置"
              : "生图服务暂未配置 — 请联系管理员"}
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
            <ImageGenView
              model={currentModel}
              onGenerate={actions.handleGenerateImageBatch}
              onEditImage={actions.handleEditImage}
              onEditImageBatch={actions.handleEditImageBatch}
              onStopGenerate={actions.handleStopGenerateImage}
              onRetryGenerate={actions.handleRetryImageTask}
              generating={generating}
              history={imageHistory}
              activeImage={activeImage}
              onActiveImageChange={handleActiveImageChange}
              onDeleteImage={handleDeleteImage}
              credits={credits}
              isAdmin={isAdmin}
              onWalletClick={() => setWalletOpen(true)}
              mobileTab={mobileTab}
              onMobileGenerateTab={() => handleSelectImageTab("generate")}
              keyboardInset={mobileViewport.keyboardInset}
              keyboardOpen={mobileViewport.keyboardOpen}
            />
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
