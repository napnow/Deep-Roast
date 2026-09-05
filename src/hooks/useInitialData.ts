"use client";

import { useCallback, useEffect } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson } from "@/lib/client-api";
import type { Config, Conversation, ImageRecord } from "@/types";
import { DEFAULT_IMAGE_MODELS } from "@/types";

/** 挂载时加载配置 / 图片历史 / 积分与签到状态 */
export function useInitialData() {
  const {
    replaceConfig,
    setImageModels,
    setSelectedImageModel,
    setConversations,
    setImageHistory,
    setCredits,
    setCheckinStatus,
  } = useDeepRoastStore();

  const applyEnabledImageModels = useCallback(
    (cfg: Config) => {
      const ids =
        cfg.enabledImageModels ?? DEFAULT_IMAGE_MODELS.map((m) => m.id);
      setImageModels(ids.map((id) => ({ id })));
    },
    [setImageModels],
  );

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await apiJson<Config>("/api/config");
      replaceConfig(cfg);
      applyEnabledImageModels(cfg);
      // 所选模型跟随默认模型初始化（仅首次/默认值未在启用列表时）
      const { selectedImageModel } = useDeepRoastStore.getState();
      const enabled =
        cfg.enabledImageModels ?? DEFAULT_IMAGE_MODELS.map((m) => m.id);
      if (!enabled.includes(selectedImageModel)) {
        setSelectedImageModel(
          enabled.includes(cfg.imageModel) ? cfg.imageModel : enabled[0] || "",
        );
      }
    } catch {
      console.error("Failed to load config");
    }
  }, [
    replaceConfig,
    applyEnabledImageModels,
    setSelectedImageModel,
  ]);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await apiJson<Conversation[]>("/api/conversations"));
    } catch {
      console.error("Failed to load conversations");
    }
  }, [setConversations]);

  const loadImageHistory = useCallback(async () => {
    try {
      setImageHistory(await apiJson<ImageRecord[]>("/api/image-history"));
    } catch {
      console.error("Failed to load image history");
    }
  }, [setImageHistory]);

  const loadCredits = useCallback(async () => {
    try {
      const data = await apiJson<{
        credits?: number;
        checkin?: {
          eligible?: boolean;
          todayChecked?: boolean;
          reward?: number;
        };
      }>("/api/auth/me");
      setCredits(data.credits ?? 0);
      if (data.checkin) {
        setCheckinStatus({
          eligible: !!data.checkin.eligible,
          todayChecked: !!data.checkin.todayChecked,
          reward: data.checkin.reward,
        });
      }
    } catch {
      // 未登录时 401，忽略
    }
  }, [setCredits, setCheckinStatus]);

  useEffect(() => {
    loadConfig();
    loadImageHistory();
    loadCredits();
    loadConversations();
  }, [loadConfig, loadImageHistory, loadCredits, loadConversations]);

  return { loadConfig, loadImageHistory, loadCredits, loadConversations };
}
