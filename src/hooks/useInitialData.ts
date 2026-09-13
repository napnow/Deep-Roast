"use client";

import { useCallback, useEffect, useState } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson } from "@/lib/client-api";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";
import type { Config, Conversation, ImageRecord } from "@/types";
import { DEFAULT_IMAGE_MODELS } from "@/types";
import {
  IMAGE_MODEL_PREFERENCE_STORAGE_KEY,
  resolveImageModelAfterConfigLoad,
} from "@/lib/image-model-preferences";

/** 挂载时加载配置 / 图片历史 / 积分与签到状态 */
export function useInitialData() {
  const [requests] = useState(createClientSessionLifecycle);
  const {
    userSessionId,
    userSessionVersion,
    replaceConfig,
    setImageModels,
    setSelectedImageModel,
    setConversations,
    setImageHistory,
    setCredits,
    setCheckinStatus,
  } = useDeepRoastStore();

  useEffect(() => {
    requests.activate();
    const unsubscribe = useDeepRoastStore.subscribe((state, previous) => {
      if (state.userSessionVersion !== previous.userSessionVersion) {
        requests.invalidate();
      }
    });
    return () => {
      unsubscribe();
      requests.dispose();
    };
  }, [requests]);

  const applyEnabledImageModels = useCallback(
    (cfg: Config) => {
      const ids =
        cfg.enabledImageModels ?? DEFAULT_IMAGE_MODELS.map((m) => m.id);
      setImageModels(ids.map((id) => ({ id })));
    },
    [setImageModels],
  );

  const loadConfig = useCallback(async () => {
    if (!userSessionId) return;
    const request = requests.start("config", userSessionVersion);
    if (!request) return;
    const selectedModelAtRequestStart =
      useDeepRoastStore.getState().selectedImageModel;
    try {
      const cfg = await apiJson<Config>("/api/config", { signal: request.signal });
      if (!request.isCurrent()) return;
      replaceConfig(cfg);
      applyEnabledImageModels(cfg);
      const enabled =
        cfg.enabledImageModels ?? DEFAULT_IMAGE_MODELS.map((m) => m.id);
      let storedModel: string | null = null;
      try {
        storedModel = window.localStorage.getItem(
          IMAGE_MODEL_PREFERENCE_STORAGE_KEY,
        );
      } catch {
        // 浏览器禁用本地存储时回落到服务端默认模型
      }
      const selectedModelAfterRequest =
        useDeepRoastStore.getState().selectedImageModel;
      setSelectedImageModel(
        resolveImageModelAfterConfigLoad(
          storedModel,
          selectedModelAtRequestStart,
          selectedModelAfterRequest,
          enabled,
          cfg.imageModel,
        ),
      );
    } catch {
      if (request.isCurrent()) console.error("Failed to load config");
    } finally {
      request.finish();
    }
  }, [
    requests,
    userSessionId,
    userSessionVersion,
    replaceConfig,
    applyEnabledImageModels,
    setSelectedImageModel,
  ]);

  const loadConversations = useCallback(async () => {
    if (!userSessionId) return;
    const request = requests.start("conversations", userSessionVersion);
    if (!request) return;
    try {
      const data = await apiJson<Conversation[]>("/api/conversations", { signal: request.signal });
      if (request.isCurrent()) setConversations(data);
    } catch {
      if (request.isCurrent()) console.error("Failed to load conversations");
    } finally {
      request.finish();
    }
  }, [requests, userSessionId, userSessionVersion, setConversations]);

  const loadImageHistory = useCallback(async () => {
    if (!userSessionId) return;
    const request = requests.start("images", userSessionVersion);
    if (!request) return;
    try {
      const data = await apiJson<ImageRecord[]>("/api/image-history", { signal: request.signal });
      if (request.isCurrent()) setImageHistory(data);
    } catch {
      if (request.isCurrent()) console.error("Failed to load image history");
    } finally {
      request.finish();
    }
  }, [requests, userSessionId, userSessionVersion, setImageHistory]);

  const loadCredits = useCallback(async () => {
    if (!userSessionId) return;
    const request = requests.start("credits", userSessionVersion);
    if (!request) return;
    try {
      const data = await apiJson<{
        credits?: number;
        checkin?: {
          eligible?: boolean;
          todayChecked?: boolean;
          reward?: number;
        };
      }>("/api/auth/me", { signal: request.signal });
      if (!request.isCurrent()) return;
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
    } finally {
      request.finish();
    }
  }, [requests, userSessionId, userSessionVersion, setCredits, setCheckinStatus]);

  useEffect(() => {
    loadConfig();
    loadImageHistory();
    loadCredits();
    loadConversations();
  }, [loadConfig, loadImageHistory, loadCredits, loadConversations]);

  return { loadConfig, loadImageHistory, loadCredits, loadConversations };
}
