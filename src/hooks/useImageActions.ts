"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";

export function useImageActions(loadCredits: () => Promise<void>) {
  const { toast } = useToast();
  const imageAbortRef = useRef<AbortController | null>(null);
  const { setImageHistory, setGenerating, setWalletOpen } = useDeepRoastStore();

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
          thumbUrl?: string;
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
            thumbUrl: data.thumbUrl,
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
            toast("积分不足，请先签到或联系管理员", "error");
            setWalletOpen(true);
          } else {
            toast(err.message || "图片生成失败", "error");
          }
        } else {
          toast("网络错误", "error");
        }
      }
      setGenerating(false);
    },
    [setGenerating, setImageHistory, toast, loadCredits, setWalletOpen],
  );

  const handleStopGenerateImage = useCallback(() => {
    imageAbortRef.current?.abort();
    setGenerating(false);
  }, [setGenerating]);

  /** 图生图：原图直传编辑（/api/image-edit），结果并入历史 */
  const handleEditImage = useCallback(
    async (image: string, prompt: string, size: string) => {
      setGenerating(true);
      const abort = new AbortController();
      imageAbortRef.current = abort;
      try {
        const data = await apiJson<{
          id: string;
          prompt: string;
          model: string;
          imageUrl: string;
          thumbUrl?: string;
          size: string;
        }>("/api/image-edit", {
          method: "POST",
          ...jsonBody({ image, prompt, size }),
          signal: abort.signal,
        });
        setImageHistory((prev) => [
          {
            id: data.id,
            prompt: data.prompt,
            model: data.model,
            imageUrl: data.imageUrl,
            thumbUrl: data.thumbUrl,
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
            toast("积分不足，请先签到或联系管理员", "error");
            setWalletOpen(true);
          } else {
            toast(err.message || "图生图失败", "error");
          }
        } else {
          toast("网络错误", "error");
        }
      }
      setGenerating(false);
    },
    [setGenerating, setImageHistory, toast, loadCredits, setWalletOpen],
  );

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
    handleEditImage,
    handleStopGenerateImage,
    handleDeleteImage,
  };
}
