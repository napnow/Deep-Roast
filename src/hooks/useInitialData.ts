"use client";

import { useCallback, useEffect } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson } from "@/lib/client-api";
import type { Config, Conversation, ImageRecord } from "@/types";
import { DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS } from "@/types";

function idsToModels(ids: string[] | undefined, fallback: { id: string }[]) {
  if (ids?.length) return ids.map((id) => ({ id }));
  return fallback;
}

/** 挂载时加载配置 / 会话 / 图片历史 / 积分与签到状态 */
export function useInitialData() {
  const {
    replaceConfig,
    setTextModels,
    setImageModels,
    setConversations,
    setImageHistory,
    setCredits,
    setCheckinStatus,
  } = useDeepRoastStore();

  const applyEnabledModels = useCallback(
    (cfg: Config) => {
      setTextModels(
        idsToModels(cfg.enabledTextModels, DEFAULT_TEXT_MODELS),
      );
      setImageModels(
        idsToModels(cfg.enabledImageModels, DEFAULT_IMAGE_MODELS),
      );
    },
    [setTextModels, setImageModels],
  );

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await apiJson<Config>("/api/config");
      replaceConfig(cfg);
      applyEnabledModels(cfg);
    } catch {
      console.error("Failed to load config");
    }
  }, [replaceConfig, applyEnabledModels]);

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
        checkin?: { eligible?: boolean; todayChecked?: boolean };
      }>("/api/auth/me");
      setCredits(data.credits ?? 0);
      if (data.checkin) {
        setCheckinStatus({
          eligible: !!data.checkin.eligible,
          todayChecked: !!data.checkin.todayChecked,
        });
      }
    } catch {
      // 未登录时 401，忽略
    }
  }, [setCredits, setCheckinStatus]);

  useEffect(() => {
    loadConfig();
    loadConversations();
    loadImageHistory();
    loadCredits();
  }, [loadConfig, loadConversations, loadImageHistory, loadCredits]);

  return { loadConfig, loadConversations, loadImageHistory, loadCredits };
}
