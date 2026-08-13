"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";

/** 发送前校验所选模型仍在管理员启用列表，防止管理员删除后发旧模型 → 400 */
function resolveRequestModel(): string {
  const { config, selectedImageModel } = useDeepRoastStore.getState();
  const enabled = config.enabledImageModels?.length
    ? config.enabledImageModels
    : null;
  if (
    selectedImageModel &&
    (!enabled || enabled.includes(selectedImageModel))
  ) {
    return selectedImageModel;
  }
  return config.imageModel;
}

export function useImageActions(loadCredits: () => Promise<void>) {
  const { toast } = useToast();
  const imageAbortRef = useRef<AbortController | null>(null);
  const { setImageHistory, setGenerating, setWalletOpen } = useDeepRoastStore();

  const handleGenerateImage = useCallback(
    async (prompt: string, size: string) => {
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
        }>("/api/image", {
          method: "POST",
          ...jsonBody({
            prompt,
            size,
            model: resolveRequestModel(),
          }),
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

  /** 图生图：原图直传编辑（/api/image-edit），支持多张参考图，结果并入历史 */
  const handleEditImage = useCallback(
    async (images: string[], prompt: string, size: string) => {
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
          ...jsonBody({
            image: images,
            prompt,
            size,
            model: resolveRequestModel(),
          }),
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

  /** 图生图批量：同参考图（支持多张）生成 N 张变体（最多 5），结果并入历史 */
  const handleEditImageBatch = useCallback(
    async (images: string[], prompt: string, size: string, count: number) => {
      setGenerating(true);
      const abort = new AbortController();
      imageAbortRef.current = abort;
      try {
        const data = await apiJson<{
          images: {
            id: string;
            prompt: string;
            model: string;
            imageUrl: string;
            thumbUrl?: string;
            size: string;
          }[];
          total: number;
          succeeded: number;
          failed: number;
          lastError?: string | null;
        }>("/api/image-edit/batch", {
          method: "POST",
          ...jsonBody({
            image: images,
            prompt,
            size,
            count,
            model: resolveRequestModel(),
          }),
          signal: abort.signal,
        });
        const list = (data.images || []).map((img) => ({
          id: img.id,
          prompt: img.prompt,
          model: img.model,
          imageUrl: img.imageUrl,
          thumbUrl: img.thumbUrl,
          size: img.size,
          createdAt: new Date().toISOString(),
        }));
        setImageHistory((prev) => [...list, ...prev]);
        if (data.succeeded > 0) {
          toast(
            data.failed > 0
              ? `生成成功 ${data.succeeded} 张，失败 ${data.failed} 张`
              : `生成成功 ${data.succeeded} 张`,
            "success",
          );
        } else {
          toast(data.lastError || "批量生成失败", "error");
        }
        loadCredits();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // stopped
        } else if (err instanceof ApiError) {
          if (err.code === "INSUFFICIENT_CREDITS") {
            toast("积分不足，请先签到或联系管理员", "error");
            setWalletOpen(true);
          } else {
            toast(err.message || "批量生成失败", "error");
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
    handleEditImageBatch,
    handleStopGenerateImage,
    handleDeleteImage,
  };
}
