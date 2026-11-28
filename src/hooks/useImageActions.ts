"use client";

import { getRefundPendingNotice } from "@/lib/image-edit-feedback";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";
import { isGeminiImageModel } from "@/lib/image-model-capabilities";
import {
  classifyImageTaskError,
  shouldReuseIdempotencyKey,
} from "@/lib/image-task";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

/** 发送前校验所选模型仍在管理员启用列表，防止管理员删除后发旧模型 → 400；图生图自动避开仅支持文生图的 Gemini 模型 */
function resolveRequestModel(mode: "text" | "edit" = "text"): string {
  const { config, selectedImageModel } = useDeepRoastStore.getState();
  const enabled = config.enabledImageModels;
  const compatible = (id: string) => mode !== "edit" || !isGeminiImageModel(id);

  if (enabled !== undefined) {
    if (
      selectedImageModel &&
      enabled.includes(selectedImageModel) &&
      compatible(selectedImageModel)
    ) {
      return selectedImageModel;
    }
    if (
      config.imageModel &&
      enabled.includes(config.imageModel) &&
      compatible(config.imageModel)
    ) {
      return config.imageModel;
    }
    if (mode === "edit") {
      const fallbackEdit = enabled.find((id) => !isGeminiImageModel(id));
      if (fallbackEdit) return fallbackEdit;
    }
    if (selectedImageModel && enabled.includes(selectedImageModel)) {
      return selectedImageModel;
    }
    if (config.imageModel && enabled.includes(config.imageModel)) {
      return config.imageModel;
    }
    throw new ApiError("管理员暂未启用图片模型", 503, "MODEL_UNAVAILABLE");
  }
  if (mode === "edit" && selectedImageModel && isGeminiImageModel(selectedImageModel)) {
    if (config.imageModel && !isGeminiImageModel(config.imageModel)) {
      return config.imageModel;
    }
  }
  return selectedImageModel || config.imageModel;
}

function idempotencyHeaders(key = crypto.randomUUID()): HeadersInit {
  return { "Idempotency-Key": key };
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
  } = useDeepRoastStore(
    useShallow((state) => ({
      userSessionVersion: state.userSessionVersion,
      setImageHistory: state.setImageHistory,
      setGenerating: state.setGenerating,
      setWalletOpen: state.setWalletOpen,
      setActiveImageId: state.setActiveImageId,
      startImageTask: state.startImageTask,
      finishImageTask: state.finishImageTask,
      failImageTask: state.failImageTask,
      clearImageTask: state.clearImageTask,
    })),
  );

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
    async (prompt: string, size: string, retryKey?: string) => {
      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
      const idempotencyKey = retryKey ?? crypto.randomUUID();
      setGenerating(true);
      startImageTask({ mode: "text", prompt, size, count: 1, idempotencyKey });
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
          }, idempotencyHeaders(idempotencyKey)),
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
    async (prompt: string, size: string, requestedCount = 1, retryKey?: string) => {
      const count = Math.min(Math.max(Math.floor(requestedCount) || 1, 1), 5);
      if (count === 1) {
        await handleGenerateImage(prompt, size, retryKey);
        return;
      }

      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
      const batchGeneration = generation;
      const idempotencyKey = retryKey ?? crypto.randomUUID();
      setGenerating(true);
      startImageTask({ mode: "text", prompt, size, count, idempotencyKey });
      const results: {
        id: string;
        prompt: string;
        model: string;
        imageUrl: string;
        thumbUrl?: string;
        size: string;
        createdAt: string;
        sourceMode: "text";
        batchIndex: number;
      }[] = [];
      let failure: unknown = null;
      let published = false;
      const publishCompleted = () => {
        if (!generation.isCurrent() || published || results.length === 0) return false;
        published = true;
        const ordered = [...results].sort((a, b) => a.batchIndex - b.batchIndex);
        setImageHistory((previous) => [
          // The key is intentionally omitted from the persisted history item.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ...ordered.map(({ batchIndex: _index, ...item }) => item),
          ...previous,
        ]);
        setActiveImageId(ordered[0].id);
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
          let nextIndex = 0;
          async function worker() {
            while (nextIndex < count && !failure && batchGeneration.isCurrent()) {
              const index = nextIndex++;
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
              ...jsonBody(
                { prompt, size, model: resolveRequestModel() },
                idempotencyHeaders(`${idempotencyKey}:${index}`),
              ),
              signal: batchGeneration.signal,
            });
                if (!batchGeneration.isCurrent()) return;
                results.push({ ...data, createdAt: new Date().toISOString(), sourceMode: "text", batchIndex: index });
              } catch (error: unknown) {
                if (!batchGeneration.isCurrent()) return;
                const priority = (value: unknown) => value instanceof ApiError
                  ? value.code === "CREDIT_REFUND_PENDING"
                    ? 5
                    : value.code === "IMAGE_CONTENT_POLICY"
                      ? 4
                      : value.code === "INSUFFICIENT_CREDITS"
                        ? 3
                        : value.code === "IDEMPOTENCY_IN_PROGRESS"
                          ? 2
                          : 1
                  : 2;
                if (!failure || priority(error) > priority(failure)) failure = error;
              }
            }
          }
          await Promise.all(Array.from({ length: Math.min(2, count) }, () => worker()));
        } catch (error: unknown) {
          if (!generation.isCurrent()) return;
          failure = error;
        }

        // Never publish a cancelled batch's buffered images into another task/session.
        if (!generation.isCurrent()) return;
        if (publishCompleted()) {
          finishImageTask([...results].sort((a, b) => a.batchIndex - b.batchIndex).map((item) => item.id));
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
    async (request: ImageEditRequest, size: string, retryKey?: string) => {
      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
      const idempotencyKey = retryKey ?? crypto.randomUUID();
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
        idempotencyKey,
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
            sourceImageId?: string | null;
            versionGroupId?: string;
          }[];
          refundPending?: boolean;
          lastError?: string | null;
        }>("/api/image-edit", {
          method: "POST",
          ...jsonBody({
            ...request,
            prompt,
            size,
            model: resolveRequestModel("edit"),
          }, idempotencyHeaders(idempotencyKey)),
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
          sourceImageId: img.sourceImageId,
          versionGroupId: img.versionGroupId,
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
    async (request: ImageEditRequest, size: string, count: number, retryKey?: string) => {
      const generation = requests.start("generation", userSessionVersion);
      if (!generation) return;
      const idempotencyKey = retryKey ?? crypto.randomUUID();
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
        idempotencyKey,
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
            sourceImageId?: string | null;
            versionGroupId?: string;
          }[];
          total: number;
          succeeded: number;
          failed: number;
          lastError?: string | null;
          refundPending?: boolean;
          contentPolicyRejected?: boolean;
        }>("/api/image-edit/batch", {
          method: "POST",
          ...jsonBody({
            ...request,
            prompt,
            size,
            count,
            model: resolveRequestModel("edit"),
          }, idempotencyHeaders(idempotencyKey)),
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
          sourceImageId: img.sourceImageId,
          versionGroupId: img.versionGroupId,
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
        } else if (data.succeeded > 0 && data.contentPolicyRejected) {
          toast(`生成成功 ${data.succeeded} 张，部分图片未通过内容审核。${data.lastError || "请检查提示词或参考图后重试。"}`, "error");
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
    const { request, error } = useDeepRoastStore.getState().imageTask;
    if (!request) return;
    // Reuse the previous key when the client never received a definitive
    // outcome (network drop or server still processing the same key). Once the
    // server persisted a terminal failed status, mint a new key on retry.
    const retryKey = shouldReuseIdempotencyKey(error)
      ? request.idempotencyKey
      : undefined;
    if (request.mode === "text") {
      await handleGenerateImageBatch(request.prompt, request.size, request.count, retryKey);
    } else if (request.editRequest) {
      if (request.count > 1) {
        await handleEditImageBatch(
          request.editRequest,
          request.size,
          request.count,
          retryKey,
        );
      } else {
        await handleEditImage(request.editRequest, request.size, retryKey);
      }
    } else if (request.count > 1) {
      await handleEditImageBatch(
        {
          image: request.images || [],
          prompt: request.prompt,
        },
        request.size,
        request.count,
        retryKey,
      );
    } else {
      await handleEditImage(
        {
          image: request.images || [],
          prompt: request.prompt,
        },
        request.size,
        retryKey,
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
        window.dispatchEvent(new CustomEvent("deeproast:image-deleted", { detail: id }));
        toast("图片已删除", "success");
      } catch {
        if (deletion.isCurrent()) toast("删除失败", "error");
      } finally {
        deletion.finish();
      }
    },
    [requests, userSessionVersion, setImageHistory, toast],
  );

  const handleBatchDeleteImages = useCallback(
    async (ids: string[], mode: "selected" | "version-group") => {
      const uniqueIds = [...new Set(ids)];
      if (!uniqueIds.length) return [];
      try {
        const result = mode === "version-group"
          ? await apiJson<{ deletedIds: string[] }>(`/api/image-history/version-group/${encodeURIComponent(uniqueIds[0]!)}`, { method: "DELETE" })
          : await apiJson<{ deletedIds: string[]; failedIds: string[] }>("/api/image-history/batch", {
              method: "POST",
              ...jsonBody({ ids: uniqueIds }),
            });
        const deletedIds = result.deletedIds || [];
        setImageHistory((prev) => prev.filter((img) => !deletedIds.includes(img.id)));
        deletedIds.forEach((id) => window.dispatchEvent(new CustomEvent("deeproast:image-deleted", { detail: id })));
        toast(`已删除 ${deletedIds.length} 张图片`, "success");
        return deletedIds;
      } catch {
        toast("批量删除失败，请稍后重试", "error");
        return [];
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
    handleBatchDeleteImages,
  };
}
