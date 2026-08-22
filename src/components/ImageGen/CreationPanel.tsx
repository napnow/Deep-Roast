"use client";

import Img2ImgPanel from "./Img2ImgPanel";
import ReversePromptPanel from "./ReversePromptPanel";
import TextToImageForm from "./TextToImageForm";
import { getSizeOptions } from "./imageUtils";
import { applyReversePrompt, generationCost } from "@/lib/image-workspace";
import { canUseImageGeneration } from "@/lib/image-generation-access";
import { useDeepRoastStore } from "@/lib/store";
import { AppIcon } from "@/components/ui/icons";
import { CREDIT_PER_IMAGE } from "@/types";

interface CreationPanelProps {
  model: string;
  credits: number;
  isAdmin: boolean;
  generating: boolean;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  onEdit: (images: string[], prompt: string, size: string, count: number) => void;
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
    setTextToImageDraft,
    config,
  } = useDeepRoastStore();
  const sizeOptions = getSizeOptions(model);
  const normalizedSize = sizeOptions.some(
    (option) => option.value === textToImageDraft.size,
  )
    ? textToImageDraft.size
    : sizeOptions[0]?.value || "1024x1024";
  const visibleTextDraft = { ...textToImageDraft, size: normalizedSize };
  const cost = generationCost(textToImageDraft.count, CREDIT_PER_IMAGE);
  const canAfford = isAdmin || credits >= cost;
  const imageGenerationAvailable = canUseImageGeneration(
    isAdmin ? "admin" : "user",
    config.imageGenerationEnabled !== false,
  );

  function submitText() {
    const prompt = textToImageDraft.prompt.trim();
    if (!prompt || generating || !canAfford || !imageGenerationAvailable) return;
    const finalPrompt = textToImageDraft.stylePrompt
      ? `${textToImageDraft.stylePrompt}\n\n${prompt}`
      : prompt;
    onGenerate(finalPrompt, normalizedSize, textToImageDraft.count);
  }

  function useReversePrompt(prompt: string) {
    setTextToImageDraft(applyReversePrompt(textToImageDraft, prompt));
    setImageCreationMode("text");
  }

  return (
    <aside className="creation-panel">
      <div className="creation-panel__header">
        <p className="ui-kicker">创作控制台</p>
        <div className="creation-mode-tabs" role="tablist" aria-label="生图方式">
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
            model={model}
            sizeOptions={sizeOptions}
            disabled={generating || !imageGenerationAvailable}
            onChange={setTextToImageDraft}
          />
        </div>
        <div hidden={imageCreationMode !== "edit"}>
          <Img2ImgPanel
            size={normalizedSize}
            sizeOptions={sizeOptions}
            generating={generating}
            disabled={!imageGenerationAvailable}
            onGenerate={onGenerate}
            onEditImage={(images, prompt, size) => onEdit(images, prompt, size, 1)}
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
                <span>{isAdmin ? "管理员免费" : `预计 ${cost} 积分`}</span>
                {!isAdmin ? <span>余额 {credits}</span> : null}
              </div>
            )}
            <button
              type="button"
              className={`ui-button w-full ${generating ? "ui-button--danger" : "ui-button--primary"}`}
              disabled={
                !generating &&
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
              <button type="button" className="text-xs text-[var(--danger)]" onClick={onWalletClick}>
                积分不足，打开钱包
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {imageCreationMode === "edit" ? "在上方上传参考图并提交生成" : "上传图片后分析并带入文生图"}
          </p>
        )}
      </div>
    </aside>
  );
}
