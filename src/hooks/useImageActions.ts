"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";
import { classifyImageTaskError } from "@/lib/image-task";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

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

function idempotencyHeaders(): HeadersInit {
  return { "Idempotency-Key": crypto.randomUUID() };
}

export function useImageActions(loadCredits: () => Promise<void>) {
  const { toast } = useToast();
  const imageAbortRef = useRef<AbortController | null>(null);
  const {
    setImageHistory,
    setGenerating,
    setWalletOpen,
    setActiveImageId,
    startImageTask,
    finishImageTask,
    failImageTask,
    clearImageTask,
  } = useDeepRoastStore();

  const handleGenerateImage = useCallback(
    async (prompt: string, size: string) => {
      setGenerating(true);
      startImageTask({ mode: "text", prompt, size, count: 1 });
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
          }, idempotencyHeaders()),
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
            sourceMode: "text",
          },
          ...prev,
        ]);
        finishImageTask([data.id]);
        setActiveImageId(data.id);
        toast("图片生成成功", "success");
        loadCredits();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          clearImageTask();
        } else if (err instanceof ApiError) {
          failImageTask(classifyImageTaskError(err));
          if (err.code === "INSUFFICIENT_CREDITS") {
            toast("积分不足，请先签到或联系管理员", "error");
            setWalletOpen(true);
          } else {
            toast(err.message || "图片生成失败", "error");
          }
        } else {
          failImageTask(classifyImageTaskError(err));
          toast("网络错误", "error");
        }
      }
      setGenerating(false);
    },
    [clearImageTask, failImageTask, finishImageTask, loadCredits, setActiveImageId, setGenerating, setImageHistory, setWalletOpen, startImageTask, toast],
  );

  const handleGenerateImageBatch = useCallback(
    async (prompt: string, size: string, requestedCount = 1) => {
      const count = Math.min(Math.max(Math.floor(requestedCount) || 1, 1), 5);
      if (count === 1) {
        await handleGenerateImage(prompt, size);
        return;
      }

      setGenerating(true);
      startImageTask({ mode: "text", prompt, size, count });
      const abort = new AbortController();
      imageAbortRef.current = abort;
      const results: {
        id: string;
        prompt: string;
        model: string;
        imageUrl: string;
        thumbUrl?: string;
        size: string;
        createdAt: string;
        sourceMode: "text";
      }[] = [];
      let failure: unknown = null;

      try {
        for (let index = 0; index < count; index += 1) {
          const data = await apiJson<{
            id: string;
            prompt: string;
            model: string;
            imageUrl: string;
            thumbUrl?: string;
            size: string;
          }>("/api/image", {
            method: "POST",
            ...jsonBody({ prompt, size, model: resolveRequestModel() }, idempotencyHeaders()),
            signal: abort.signal,
          });
          results.push({
            ...data,
            createdAt: new Date().toISOString(),
            sourceMode: "text",
          });
        }
      } catch (error: unknown) {
        failure = error;
      }

      if (results.length > 0) {
        setImageHistory((previous) => [...results, ...previous]);
        finishImageTask(results.map((item) => item.id));
        setActiveImageId(results[0].id);
        toast(`生成成功 ${results.length} 张`, "success");
        await loadCredits();
      }

      if (failure && !(failure instanceof Error && failure.name === "AbortError")) {
        if (results.length === 0) failImageTask(classifyImageTaskError(failure));
        if (failure instanceof ApiError && failure.code === "INSUFFICIENT_CREDITS") {
          toast("积分不足，批量生成已停止", "error");
          setWalletOpen(true);
        } else {
          toast(failure instanceof Error ? failure.message : "批量生成失败", "error");
        }
      }
      if (failure instanceof Error && failure.name === "AbortError") clearImageTask();
      setGenerating(false);
    },
    [
      handleGenerateImage,
      clearImageTask,
      failImageTask,
      finishImageTask,
      loadCredits,
      setActiveImageId,
      setGenerating,
      setImageHistory,
      setWalletOpen,
      startImageTask,
      toast,
    ],
  );

  const handleStopGenerateImage = useCallback(() => {
    imageAbortRef.current?.abort();
    setGenerating(false);
    clearImageTask();
  }, [clearImageTask, setGenerating]);

  /** 图生图：提交逐图或目标/参考结构化任务 */
  const handleEditImage = useCallback(
    async (request: ImageEditRequest, size: string) => {
      const prompt =
        request.prompt ||
        request.items?.map((item) => item.prompt).filter(Boolean).join("；") ||
        "图生图";
      const legacyImages =
        request.mode === "reference"
          ? [request.targetImage || "", ...(request.referenceImages || [])]
          : request.items?.map((item) => item.image) || request.image || [];
      setGenerating(true);
      startImageTask({
        mode: "edit",
        prompt,
        size,
        count: 1,
        images: Array.isArray(legacyImages) ? legacyImages : [legacyImages],
        editRequest: request,
      });
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
        }>("/api/image-edit", {
          method: "POST",
          ...jsonBody({
            ...request,
            prompt,
            size,
            model: resolveRequestModel(),
          }, idempotencyHeaders()),
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
          sourceMode: "edit" as const,
        }));
        setImageHistory((prev) => [...list, ...prev]);
        finishImageTask(list.map((item) => item.id));
        if (list[0]) setActiveImageId(list[0].id);
        toast(
          list.length > 1
            ? "生成成功 " + list.length + " 张"
            : "图片生成成功",
          "success",
        );
        loadCredits();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          clearImageTask();
        } else if (err instanceof ApiError) {
          failImageTask(classifyImageTaskError(err));
          if (err.code === "INSUFFICIENT_CREDITS") {
            toast("积分不足，请先签到或联系管理员", "error");
            setWalletOpen(true);
          } else {
            toast(err.message || "图生图失败", "error");
          }
        } else {
          failImageTask(classifyImageTaskError(err));
          toast("网络错误", "error");
        }
      }
      setGenerating(false);
    },
    [clearImageTask, failImageTask, finishImageTask, loadCredits, setActiveImageId, setGenerating, setImageHistory, setWalletOpen, startImageTask, toast],
  );

  /** 图生图批量：按结构化任务生成 N 张变体（最多 5） */
  const handleEditImageBatch = useCallback(
    async (request: ImageEditRequest, size: string, count: number) => {
      const prompt =
        request.prompt ||
        request.items?.map((item) => item.prompt).filter(Boolean).join("；") ||
        "图生图";
      const legacyImages =
        request.mode === "reference"
          ? [request.targetImage || "", ...(request.referenceImages || [])]
          : request.items?.map((item) => item.image) || request.image || [];
      setGenerating(true);
      startImageTask({
        mode: "edit",
        prompt,
        size,
        count,
        images: Array.isArray(legacyImages) ? legacyImages : [legacyImages],
        editRequest: request,
      });
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
            ...request,
            prompt,
            size,
            count,
            model: resolveRequestModel(),
          }, idempotencyHeaders()),
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
          sourceMode: "edit" as const,
        }));
        setImageHistory((prev) => [...list, ...prev]);
        if (list.length > 0) {
          finishImageTask(list.map((item) => item.id));
          setActiveImageId(list[0].id);
        } else {
          failImageTask({ kind: "service", message: data.lastError || "批量生成失败" });
        }
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
          clearImageTask();
        } else if (err instanceof ApiError) {
          failImageTask(classifyImageTaskError(err));
          if (err.code === "INSUFFICIENT_CREDITS") {
            toast("积分不足，请先签到或联系管理员", "error");
            setWalletOpen(true);
          } else {
            toast(err.message || "批量生成失败", "error");
          }
        } else {
          failImageTask(classifyImageTaskError(err));
          toast("网络错误", "error");
        }
      }
      setGenerating(false);
    },
    [clearImageTask, failImageTask, finishImageTask, loadCredits, setActiveImageId, setGenerating, setImageHistory, setWalletOpen, startImageTask, toast],
  );

  const handleRetryImageTask = useCallback(async () => {
    const request = useDeepRoastStore.getState().imageTask.request;
    if (!request) return;
    if (request.mode === "text") {
      await handleGenerateImageBatch(request.prompt, request.size, request.count);
    } else if (request.editRequest) {
      if (request.count > 1) {
        await handleEditImageBatch(
          request.editRequest,
          request.size,
          request.count,
        );
      } else {
        await handleEditImage(request.editRequest, request.size);
      }
    } else if (request.count > 1) {
      await handleEditImageBatch(
        {
          image: request.images || [],
          prompt: request.prompt,
        },
        request.size,
        request.count,
      );
    } else {
      await handleEditImage(
        {
          image: request.images || [],
          prompt: request.prompt,
        },
        request.size,
      );
    }
  }, [handleEditImage, handleEditImageBatch, handleGenerateImageBatch]);

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
    handleGenerateImageBatch,
    handleEditImage,
    handleEditImageBatch,
    handleStopGenerateImage,
    handleRetryImageTask,
    handleDeleteImage,
  };
}
