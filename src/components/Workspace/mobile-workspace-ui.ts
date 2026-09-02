import type { WorkspaceMode } from "@/lib/workspace-preferences";

export type MobileImageTab = "generate" | "gallery" | "announcements";
export type MobilePrimaryWorkspace =
  | "generate"
  | "chat"
  | "gallery"
  | "account";

export const MOBILE_PRIMARY_WORKSPACES: ReadonlyArray<{
  id: MobilePrimaryWorkspace;
  label: string;
}> = [
  { id: "generate", label: "生图" },
  { id: "chat", label: "对话" },
  { id: "gallery", label: "作品" },
  { id: "account", label: "我的" },
];

export function getMobilePrimaryWorkspace(
  activeMode: WorkspaceMode,
  imageTab: MobileImageTab,
): MobilePrimaryWorkspace {
  if (activeMode === "chat") return "chat";
  return imageTab === "gallery" ? "gallery" : "generate";
}

export function getMobileWorkspaceTitle(
  activeMode: WorkspaceMode,
  imageTab: MobileImageTab,
): string {
  if (activeMode === "chat") return "对话";
  if (imageTab === "gallery") return "图库";
  return imageTab === "announcements" ? "公告" : "生图";
}

export function getMobileCheckinCard(input: {
  eligible: boolean;
  todayChecked: boolean;
  loading: boolean;
  reward: number;
}) {
  if (input.todayChecked) {
    return { label: "今日已签到", detail: "明日再来", disabled: true };
  }
  if (!input.eligible) {
    return { label: "签到暂不可用", detail: "请稍后重试", disabled: true };
  }
  return {
    label: input.loading ? "签到中…" : "今日签到",
    detail: `+${input.reward} 积分`,
    disabled: input.loading,
  };
}
