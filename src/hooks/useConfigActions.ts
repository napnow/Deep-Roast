"use client";

import { useCallback } from "react";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { apiJson, jsonBody } from "@/lib/client-api";

export function useConfigActions(loadConfig: () => Promise<void>) {
  const { toast } = useToast();

  const handleSaveConfig = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        await apiJson("/api/config", {
          method: "PUT",
          ...jsonBody(updates),
        });
        await loadConfig();
        toast("设置已保存", "success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "设置保存失败";
        toast(msg, "error");
        throw err;
      }
    },
    [loadConfig, toast],
  );

  /**
   * 切换模型：
   * - 文生文：写入默认 textModel；若有当前会话，同步更新 conversation.model
   * - 文生图：只写 imageModel
   */
  const handleModelChange = useCallback(
    async (model: string) => {
      const { activeMode, activeConvId, setConversations, setConfig } =
        useDeepRoastStore.getState();

      try {
        if (activeMode === "text") {
          setConfig({ textModel: model });
          if (activeConvId) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConvId ? { ...c, model } : c,
              ),
            );
            await apiJson(`/api/conversations/${activeConvId}`, {
              method: "PATCH",
              ...jsonBody({ model }),
            });
          }
          await apiJson("/api/config", {
            method: "PUT",
            ...jsonBody({ textModel: model }),
          });
        } else {
          setConfig({ imageModel: model });
          await apiJson("/api/config", {
            method: "PUT",
            ...jsonBody({ imageModel: model }),
          });
        }
        await loadConfig();
      } catch {
        toast("切换模型失败", "error");
        await loadConfig();
      }
    },
    [loadConfig, toast],
  );

  /** 从启用列表移除模型（顶栏 ✕ / 设置删除） */
  const handleModelRemove = useCallback(
    async (model: string) => {
      const {
        activeMode,
        config,
        textModels,
        imageModels,
        setTextModels,
        setImageModels,
        setConfig,
        activeConvId,
        conversations,
      } = useDeepRoastStore.getState();

      const isText = activeMode === "text";
      const current = isText
        ? textModels.map((m) => m.id)
        : imageModels.map((m) => m.id);

      if (current.length <= 1) {
        toast("至少保留一个模型", "error");
        return;
      }
      if (!current.includes(model)) return;

      const next = current.filter((id) => id !== model);

      // 乐观更新
      if (isText) {
        setTextModels(next.map((id) => ({ id })));
        const patch: Record<string, unknown> = {
          enabledTextModels: next,
        };
        if (config.textModel === model) {
          patch.textModel = next[0];
          setConfig({ textModel: next[0], enabledTextModels: next });
        } else {
          setConfig({ enabledTextModels: next });
        }
        // 当前会话若正用被删模型，切到剩余第一个
        if (
          activeConvId &&
          conversations.find((c) => c.id === activeConvId)?.model === model
        ) {
          useDeepRoastStore.getState().setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvId ? { ...c, model: next[0] } : c,
            ),
          );
          try {
            await apiJson(`/api/conversations/${activeConvId}`, {
              method: "PATCH",
              ...jsonBody({ model: next[0] }),
            });
          } catch {
            /* ignore conv patch failure; list still updated */
          }
        }
        try {
          await apiJson("/api/config", {
            method: "PUT",
            ...jsonBody(patch),
          });
          await loadConfig();
          toast("已移除模型", "success");
        } catch {
          toast("移除失败", "error");
          await loadConfig();
        }
      } else {
        setImageModels(next.map((id) => ({ id })));
        const patch: Record<string, unknown> = {
          enabledImageModels: next,
        };
        if (config.imageModel === model) {
          patch.imageModel = next[0];
          setConfig({ imageModel: next[0], enabledImageModels: next });
        } else {
          setConfig({ enabledImageModels: next });
        }
        try {
          await apiJson("/api/config", {
            method: "PUT",
            ...jsonBody(patch),
          });
          await loadConfig();
          toast("已移除模型", "success");
        } catch {
          toast("移除失败", "error");
          await loadConfig();
        }
      }
    },
    [loadConfig, toast],
  );

  return { handleSaveConfig, handleModelChange, handleModelRemove };
}
