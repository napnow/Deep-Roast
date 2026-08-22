"use client";

import { useCallback } from "react";
import { useToast } from "@/components/Toast";
import { apiJson, jsonBody } from "@/lib/client-api";

export function useConfigActions(loadConfig: () => Promise<void>) {
  const { toast } = useToast();

  /** 管理员保存配置（API Key / 模型 / 提示词等） */
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

  return { handleSaveConfig };
}
