"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";

export function useImageActions(loadCredits: () => Promise<void>) {
  const { toast } = useToast();
  const imageAbortRef = useRef<AbortController | null>(null);
  const { setImageHistory, setGenerating, setRechargeOpen } =
    useDeepRoastStore();

  const handleGenerateImage = useCallback(
    async (prompt: string, size: string) => {
      setGenerating(true);
      const abort = new AbortController();
      imageAbortRef.current = abort;
      const { config: cfg } = useDeepRoastStore.getState();
      try {
        const data = await apiJson<{
          id: string;
          prompt: string;
          model: string;
          imageUrl: string;
          size: string;
        }>("/api/image", {
          method: "POST",
          ...jsonBody({ prompt, size, model: cfg.imageModel }),
          signal: abort.signal,
        });
        setImageHistory((prev) => [
          {
            id: data.id,
            prompt: data.prompt,
            model: data.model,
            imageUrl: data.imageUrl,
            size: data.size,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast("图片生成成功", "success");
        loadCredits();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // stopped
        } else if (err instanceof ApiError) {
          if (err.code === "INSUFFICIENT_CREDITS") {
            toast("积分不足，请先充值", "error");
            setRechargeOpen(true);
          } else {
            toast(err.message || "图片生成失败", "error");
          }
        } else {
          toast("网络错误", "error");
        }
      }
      setGenerating(false);
    },
    [setGenerating, setImageHistory, toast, loadCredits, setRechargeOpen],
  );

  const handleStopGenerateImage = useCallback(() => {
    imageAbortRef.current?.abort();
    setGenerating(false);
  }, [setGenerating]);

  const handleDeleteImage = useCallback(
    async (id: string) => {
      try {
        await apiJson(`/api/image-history/${id}`, { method: "DELETE" });
        setImageHistory((prev) => prev.filter((img) => img.id !== id));
        toast("图片已删除", "success");
      } catch {
        toast("删除失败", "error");
      }
    },
    [setImageHistory, toast],
  );

  return {
    handleGenerateImage,
    handleStopGenerateImage,
    handleDeleteImage,
  };
}
