"use client";

import { useEffect, useRef, useState } from "react";
import Img2ImgPanel from "./Img2ImgPanel";
import ReversePromptPanel from "./ReversePromptPanel";
import TextToImageForm from "./TextToImageForm";
import { normalizeImageSizeSelection } from "@/lib/custom-image-ratio";
import { getSizeOptions } from "./imageUtils";
import { applyReversePrompt, generationCost } from "@/lib/image-workspace";
import { canUseImageGeneration } from "@/lib/image-generation-access";
import { useDeepRoastStore } from "@/lib/store";
import { AppIcon } from "@/components/ui/icons";
import { DEFAULT_IMAGE_MODEL_CREDIT_COST } from "@/types";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import { WORKBENCH_CLASS_NAMES } from "./creation-workbench-ui";
import { getImageModelLabel } from "./image-model-presentation";
import { apiJson, ApiError } from "@/lib/client-api";
import {
  POLISH_PROMPT_CREDIT_COST,
  parsePromptPolishResponse,
  promptPolishError,
} from "@/lib/prompt-polish";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";

interface CreationPanelProps {
  model: string;
  credits: number;
  isAdmin: boolean;
  generating: boolean;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  onEdit: (request: ImageEditRequest, size: string, count: number) => void;
  onStop: () => void;
  onWalletClick?: () => void;
}

const MODES = [
  { id: "text", label: "文生图" },
  { id: "edit", label: "图生图" },
  { id: "reverse", label: "反推" },
] as const;

export default function CreationPanel({
  model,
  credits,
  isAdmin,
  generating,
  onGenerate,
  onEdit,
  onStop,
  onWalletClick,
}: CreationPanelProps) {
  const {
    imageCreationMode,
    setImageCreationMode,
    textToImageDraft,
    textToImagePolishUndo,
    imageToImageDraft,
    setTextToImageDraft,
    setTextToImagePolishUndo,
    commitPolishedPrompt,
    setCredits,
    imageModels,
    selectedImageModel,
    setSelectedImageModel,
    config,
  } = useDeepRoastStore();
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState("");
  const polishRef = useRef(false);
  const [polishRequests] = useState(createClientSessionLifecycle);
  useEffect(() => {
    polishRequests.activate();
    const unsubscribe = useDeepRoastStore.subscribe((state, previous) => {
      if (state.userSessionVersion !== previous.userSessionVersion) {
        polishRef.current = false;
        setPolishing(false);
        polishRequests.invalidate();
      }
    });
    return () => {
      unsubscribe();
      polishRequests.dispose();
    };
  }, [polishRequests]);
  const imageModelIds = imageModels.map((item) => item.id);
  const selectedModel = imageModelIds.includes(selectedImageModel)
    ? selectedImageModel
    : model;
  const sizeOptions = getSizeOptions(model);
  const normalizedSize = normalizeImageSizeSelection(textToImageDraft.size, model, sizeOptions);
  const visibleTextDraft = { ...textToImageDraft, size: normalizedSize };
  const imageCostPerImage =
    config.imageModelCosts?.[selectedModel] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST;
  const cost = generationCost(textToImageDraft.count, imageCostPerImage);
  const canAfford = isAdmin || credits >= cost;
  const canAffordPolish =
    isAdmin || credits >= POLISH_PROMPT_CREDIT_COST;
  const hasPolishUndo =
    textToImagePolishUndo?.polished === textToImageDraft.prompt;
  const imageGenerationAvailable =
    canUseImageGeneration(
      isAdmin ? "admin" : "user",
      config.imageGenerationEnabled !== false,
    ) && Boolean(model);

  function submitText() {
    const prompt = textToImageDraft.prompt.trim();
    if (!prompt || generating || !canAfford || !imageGenerationAvailable)
      return;
    const finalPrompt = textToImageDraft.stylePrompt
      ? `${textToImageDraft.stylePrompt}\n\n${prompt}`
      : prompt;
    onGenerate(finalPrompt, normalizedSize, textToImageDraft.count);
  }

  function useReversePrompt(prompt: string) {
    setTextToImageDraft(applyReversePrompt(textToImageDraft, prompt));
    setImageCreationMode("text");
  }

  async function handlePolishPrompt() {
    const original = textToImageDraft.prompt.trim();
    if (!original || polishRef.current || generating) return;
    if (!canAffordPolish) {
      setPolishError("积分不足，润色需要 1 积分");
      onWalletClick?.();
      return;
    }

    const request = polishRequests.start("polish");
    if (!request) return;
    polishRef.current = true;
    setPolishing(true);
    setPolishError("");
    try {
      const data = await apiJson<{ prompt?: string; model?: string }>(
        "/api/polish-prompt",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ prompt: original }),
          signal: request.signal,
        },
      );
      if (!request.isCurrent()) return;
      const result = parsePromptPolishResponse(data);
      commitPolishedPrompt({
        original,
        polished: result.prompt,
      });
      if (!isAdmin) {
        setCredits((current) =>
          Math.max(0, current - POLISH_PROMPT_CREDIT_COST),
        );
      }
    } catch (error: unknown) {
      if (!request.isCurrent()) return;
      setPolishError(promptPolishError(error));
      // A 402 from a stale balance needs the wallet even when the button was enabled.
      if (error instanceof ApiError && error.status === 402) {
        onWalletClick?.();
      }
    } finally {
      if (request.isCurrent()) {
        polishRef.current = false;
        setPolishing(false);
      }
      request.finish();
    }
  }

  function restoreOriginalPrompt() {
    if (!textToImagePolishUndo) return;
    setTextToImageDraft({ prompt: textToImagePolishUndo.original });
    setTextToImagePolishUndo(null);
    setPolishError("");
  }

  return (
    <section
      className={`${WORKBENCH_CLASS_NAMES.panel} ${WORKBENCH_CLASS_NAMES.roomyPanel} ${WORKBENCH_CLASS_NAMES.richPanel}`}
    >
      <div className="creation-panel__header">
        <div className="creation-panel__title-row">
          <div>
            <p className="ui-kicker">创作控制台</p>
            <p className="creation-panel__lead">把想法变成可继续编辑的画面</p>
          </div>
          <span className="creation-panel__mode-mark">AI WORKSPACE</span>
        </div>
        <div className="creation-status-strip" aria-label="创作状态">
          <span className="creation-status-strip__model">
            {getImageModelLabel(model)}
          </span>
          <span className="creation-status-strip__credits">
            {isAdmin ? "管理员模式" : `余额 ${credits} 积分`}
          </span>
        </div>
        <div
          className="creation-mode-tabs"
          role="tablist"
          aria-label="生图方式"
        >
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={imageCreationMode === mode.id}
              className={imageCreationMode === mode.id ? "is-active" : ""}
              onClick={() => setImageCreationMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creation-panel__body">
        <div hidden={imageCreationMode !== "text"}>
          <TextToImageForm
            draft={visibleTextDraft}
            polishing={polishing}
            polishError={polishError}
            polishUndo={hasPolishUndo ? textToImagePolishUndo : null}
            giftPolish={isAdmin}
            model={model}
            imageModels={imageModelIds}
            selectedImageModel={selectedModel}
            sizeOptions={sizeOptions}
            disabled={generating || !imageGenerationAvailable}
            onChange={setTextToImageDraft}
            onModelChange={setSelectedImageModel}
            onPolish={handlePolishPrompt}
            onRestorePrompt={restoreOriginalPrompt}
          />
        </div>
        <div hidden={imageCreationMode !== "edit"}>
          <Img2ImgPanel
            size={normalizedSize}
            imageModel={selectedModel}
            imageModelCosts={config.imageModelCosts}
            isAdmin={isAdmin}
            draft={imageToImageDraft}
            sizeOptions={sizeOptions}
            generating={generating}
            disabled={!imageGenerationAvailable}
            onGenerate={onGenerate}
            onEditImage={(request, size) => onEdit(request, size, 1)}
            onEditImageBatch={onEdit}
            onStopGenerate={onStop}
          />
        </div>
        <div hidden={imageCreationMode !== "reverse"}>
          <ReversePromptPanel
            disabled={generating}
            onPrompt={useReversePrompt}
            onCloseToolbar={() => setImageCreationMode("text")}
          />
        </div>
      </div>

      <div className="creation-panel__footer">
        {imageCreationMode === "text" ? (
          <>
            {!imageGenerationAvailable ? (
              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  color: "var(--accent)",
                  background: "var(--accent-surface)",
                  border:
                    "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                }}
              >
                生图功能暂时关闭，请稍后再试
              </p>
            ) : (
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  {isAdmin
                    ? "管理员免费"
                    : `预计 ${cost} 积分（${imageCostPerImage} / 张）`}
                </span>
                {!isAdmin ? <span>余额 {credits}</span> : null}
              </div>
            )}
            <button
              type="button"
              className={`ui-button w-full ${generating ? "ui-button--danger" : "ui-button--primary"}`}
              disabled={
                !generating &&
                !polishing &&
                (!textToImageDraft.prompt.trim() ||
                  !canAfford ||
                  !imageGenerationAvailable)
              }
              onClick={generating ? onStop : submitText}
            >
              {generating ? (
                <>停止生成</>
              ) : (
                <>
                  <AppIcon name="image" size={16} />
                  生成 {textToImageDraft.count} 张图片
                  {!isAdmin ? ` · ${cost} 积分` : ""}
                </>
              )}
            </button>
            {!canAfford && onWalletClick ? (
              <button
                type="button"
                className="text-xs text-[var(--danger)]"
                onClick={onWalletClick}
              >
                积分不足，打开钱包
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {imageCreationMode === "edit"
              ? "在上方上传参考图并提交生成"
              : "上传图片后分析并带入文生图"}
          </p>
        )}
      </div>
    </section>
  );
}
