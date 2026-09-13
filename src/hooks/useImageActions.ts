"use client";

import { getRefundPendingNotice } from "@/lib/image-edit-feedback";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";
import { classifyImageTaskError } from "@/lib/image-task";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

/** 发送前校验所选模型仍在管理员启用列表，防止管理员删除后发旧模型 → 400 */
function resolveRequestModel(): string {
  const { config, selectedImageModel } = useDeepRoastStore.getState();
  const enabled = config.enabledImageModels;
  if (enabled !== undefined) {
    if (selectedImageModel && enabled.includes(selectedImageModel)) {
      return selectedImageModel;
    }
    if (config.imageModel && enabled.includes(config.imageModel)) {
      return config.imageModel;
    }
    throw new ApiError("管理员暂未启用图片模型", 503, "MODEL_UNAVAILABLE");
  }
  return selectedImageModel || config.imageModel;
}

function idempotencyHeaders(): HeadersInit {
  return { "Idempotency-Key": crypto.randomUUID() };
}

export function useImageActions(loadCredits: () => Promise<void>) {
  const { toast } = useToast();
  const [requests] = useState(createClientSessionLifecycle);
  const batchStopRef = useRef<(() => void) | null>(null);
  const {
    userSessionVersion,
    setImageHistory,
    setGenerating,
    setWalletOpen,
    setActiveImageId,
    startImageTask,
    finishImageTask,
    failImageTask,
    clearImageTask,
  } = useDeepRoastStore();

  useEffect(() => {
    requests.activate();
    const unsubscribe = useDeepRoastStore.subscribe((state, previous) => {
      if (state.userSessionVersion !== previous.userSessionVersion) {
        batchStopRef.current = null;
        requests.invalidate();
      }
    });
    return () => {
      const ownsGeneration = requests.hasCurrent("generation");
      unsubscribe();
      requests.dispose();
      batchStopRef.current = null;
      if (ownsGeneration) {
        setGenerating(false);
        clearImageTask();
      }
    };
  }, [requests, setGenerating, clearImageTask]);

  const handleGenerateImage = useCallback(
    async (prompt: string, size: string) => {
      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
      setGenerating(true);
      startImageTask({ mode: "text", prompt, size, count: 1 });
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
          signal: generation.signal,
        });
        if (!generation.isCurrent()) return;
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
        if (!generation.isCurrent()) return;
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
      } finally {
        if (generation.isCurrent()) setGenerating(false);
        generation.finish();
      }
    },
    [requests, userSessionVersion, clearImageTask, failImageTask, finishImageTask, loadCredits, setActiveImageId, setGenerating, setImageHistory, setWalletOpen, startImageTask, toast],
  );

  const handleGenerateImageBatch = useCallback(
    async (prompt: string, size: string, requestedCount = 1) => {
      const count = Math.min(Math.max(Math.floor(requestedCount) || 1, 1), 5);
      if (count === 1) {
        await handleGenerateImage(prompt, size);
        return;
      }

      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
      setGenerating(true);
      startImageTask({ mode: "text", prompt, size, count });
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
      let published = false;
      const publishCompleted = () => {
        if (!generation.isCurrent() || published || results.length === 0) return false;
        published = true;
        setImageHistory((previous) => [...results, ...previous]);
        setActiveImageId(results[0].id);
        toast(`生成成功 ${results.length} 张`, "success");
        return true;
      };
      // Explicit Stop may keep acknowledged results, but session changes and
      // replacement requests must never publish the old batch's buffer.
      const flushOnStop = () => {
        if (publishCompleted()) void loadCredits().catch(() => {});
      };
      batchStopRef.current = flushOnStop;

      try {
        try {
          for (let index = 0; index < count; index += 1) {
            if (!generation.isCurrent()) return;
            const data = await apiJson<{
              id: string;
              prompt: string;
              model: string;
              imageUrl: string;
              thumbUrl?: string;
              size: string;
            }>("/api/image", {
              method: "POST",
              ...jsonBody(
                { prompt, size, model: resolveRequestModel() },
                idempotencyHeaders(),
              ),
              signal: generation.signal,
            });
            if (!generation.isCurrent()) return;
            results.push({
              ...data,
              createdAt: new Date().toISOString(),
              sourceMode: "text",
            });
          }
        } catch (error: unknown) {
          if (!generation.isCurrent()) return;
          failure = error;
        }

        // Never publish a cancelled batch's buffered images into another task/session.
        if (!generation.isCurrent()) return;
        if (publishCompleted()) {
          finishImageTask(results.map((item) => item.id));
          await loadCredits();
          if (!generation.isCurrent()) return;
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
      } finally {
        if (batchStopRef.current === flushOnStop) batchStopRef.current = null;
        if (generation.isCurrent()) setGenerating(false);
        generation.finish();
      }
    },
    [
      requests,
      userSessionVersion,
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
    if (!requests.isActive(userSessionVersion)) return;
    const flush = batchStopRef.current;
    batchStopRef.current = null;
    flush?.();
    requests.cancel("generation");
    setGenerating(false);
    clearImageTask();
  }, [requests, userSessionVersion, clearImageTask, setGenerating]);

  /** 图生图：提交逐图或目标/参考结构化任务 */
  const handleEditImage = useCallback(
    async (request: ImageEditRequest, size: string) => {
      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
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
          refundPending?: boolean;
          lastError?: string | null;
        }>("/api/image-edit", {
          method: "POST",
          ...jsonBody({
            ...request,
            prompt,
            size,
            model: resolveRequestModel(),
          }, idempotencyHeaders()),
          signal: generation.signal,
        });
        if (!generation.isCurrent()) return;
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
        const refundNotice = getRefundPendingNotice(data);
        if (refundNotice) {
          toast(refundNotice, "error");
        } else {
          toast(
            list.length > 1
              ? "生成成功 " + list.length + " 张"
              : "图片生成成功",
            "success",
          );
        }
        loadCredits();
      } catch (err: unknown) {
        if (!generation.isCurrent()) return;
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
      } finally {
        if (generation.isCurrent()) setGenerating(false);
        generation.finish();
      }
    },
    [requests, userSessionVersion, clearImageTask, failImageTask, finishImageTask, loadCredits, setActiveImageId, setGenerating, setImageHistory, setWalletOpen, startImageTask, toast],
  );

  /** 图生图批量：按结构化任务生成 N 张变体（最多 5） */
  const handleEditImageBatch = useCallback(
    async (request: ImageEditRequest, size: string, count: number) => {
      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
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
          refundPending?: boolean;
        }>("/api/image-edit/batch", {
          method: "POST",
          ...jsonBody({
            ...request,
            prompt,
            size,
            count,
            model: resolveRequestModel(),
          }, idempotencyHeaders()),
          signal: generation.signal,
        });
        if (!generation.isCurrent()) return;
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
        const refundNotice = getRefundPendingNotice(data);
        if (refundNotice) {
          toast(refundNotice, "error");
        } else if (data.succeeded > 0) {
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
        if (!generation.isCurrent()) return;
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
      } finally {
        if (generation.isCurrent()) setGenerating(false);
        generation.finish();
      }
    },
    [requests, userSessionVersion, clearImageTask, failImageTask, finishImageTask, loadCredits, setActiveImageId, setGenerating, setImageHistory, setWalletOpen, startImageTask, toast],
  );

  const handleRetryImageTask = useCallback(async () => {
    if (!requests.isActive(userSessionVersion)) return;
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
  }, [requests, userSessionVersion, handleEditImage, handleEditImageBatch, handleGenerateImageBatch]);

  const handleDeleteImage = useCallback(
    async (id: string) => {
      const deletion = requests.start(`delete:${id}`, userSessionVersion);
      if (!deletion) return;
      try {
        await apiJson(`/api/image-history/${id}`, { method: "DELETE", signal: deletion.signal });
        if (!deletion.isCurrent()) return;
        setImageHistory((prev) => prev.filter((img) => img.id !== id));
        toast("图片已删除", "success");
      } catch {
        if (deletion.isCurrent()) toast("删除失败", "error");
      } finally {
        deletion.finish();
      }
    },
    [requests, userSessionVersion, setImageHistory, toast],
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
