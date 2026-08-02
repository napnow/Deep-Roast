"use client";

import { useCallback, useEffect } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson } from "@/lib/client-api";
import type { Config, ImageRecord } from "@/types";
import { DEFAULT_IMAGE_MODELS } from "@/types";

/** 挂载时加载配置 / 图片历史 / 积分与签到状态 */
export function useInitialData() {
  const {
    replaceConfig,
    setImageModels,
    setImageHistory,
    setCredits,
    setCheckinStatus,
  } = useDeepRoastStore();

  const applyEnabledImageModels = useCallback(
    (cfg: Config) => {
      const ids = cfg.enabledImageModels?.length
        ? cfg.enabledImageModels
        : DEFAULT_IMAGE_MODELS.map((m) => m.id);
      setImageModels(ids.map((id) => ({ id })));
    },
    [setImageModels],
  );

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await apiJson<Config>("/api/config");
      replaceConfig(cfg);
      applyEnabledImageModels(cfg);
    } catch {
      console.error("Failed to load config");
    }
  }, [replaceConfig, applyEnabledImageModels]);

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
    loadImageHistory();
    loadCredits();
  }, [loadConfig, loadImageHistory, loadCredits]);

  return { loadConfig, loadImageHistory, loadCredits };
}
