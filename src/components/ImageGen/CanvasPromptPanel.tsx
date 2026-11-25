/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { insertPromptReference, parsePromptReferences, syncPromptPanelValue, type CanvasPromptReference } from "./canvas-prompt";
import CanvasPromptChipInput from "./CanvasPromptChipInput";
import { getSizeOptions } from "./imageUtils";
import { getImageModelLabel } from "./image-model-presentation";
import { normalizeImageSizeSelection } from "@/lib/custom-image-ratio";

export type CanvasPromptPanelSettings = {
  model: string;
  size: string;
  quality: "auto" | "low" | "medium" | "high";
  count: number;
};

export interface CanvasPromptPanelProps {
  nodeId: string;
  initialPrompt: string;
  candidates: CanvasPromptReference[];
  initialSettings?: Partial<CanvasPromptPanelSettings>;
  models?: string[];
  defaultModel?: string;
  onGenerate: (nodeId: string, prompt: string, references: CanvasPromptReference[], settings: CanvasPromptPanelSettings) => void | string[] | Promise<void | string[]>;
  onClose: () => void;
}

const fallbackModel = "gpt-image-2";

function startingSettings(initialSettings: Partial<CanvasPromptPanelSettings> | undefined, models: string[], defaultModel: string): CanvasPromptPanelSettings {
  const availableModels = models.filter(Boolean);
  const requestedModel = initialSettings?.model || defaultModel || fallbackModel;
  const model = availableModels.length
    ? (availableModels.includes(requestedModel) ? requestedModel : availableModels[0]!)
    : requestedModel;
  const sizes = getSizeOptions(model);
  return {
    model,
    size: normalizeImageSizeSelection(initialSettings?.size || sizes[0]?.value || "1024x1024", model, sizes),
    quality: initialSettings?.quality || "auto",
    count: initialSettings?.count || 1,
  };
}

export default function CanvasPromptPanel({
  nodeId,
  initialPrompt,
  candidates,
  initialSettings,
  models = [],
  defaultModel = fallbackModel,
  onGenerate,
  onClose,
}: CanvasPromptPanelProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const previousInitialPrompt = useRef(initialPrompt);
  const [settings, setSettings] = useState<CanvasPromptPanelSettings>(() => startingSettings(initialSettings, models, defaultModel));
  const [busy, setBusy] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const selected = useMemo(() => candidates.filter(candidate => prompt.includes(candidate.label)), [candidates, prompt]);
  const tokens = useMemo(() => parsePromptReferences(prompt, candidates), [candidates, prompt]);
  const availableModels = useMemo(() => models.filter(Boolean), [models]);
  const modelOptions = useMemo(() => {
    const ids = availableModels.length ? availableModels : [settings.model];
    return ids.map(model => ({ value: model, label: getImageModelLabel(model) }));
  }, [availableModels, settings.model]);
  const sizeOptions = useMemo(() => getSizeOptions(settings.model), [settings.model]);

  useEffect(() => {
    setPrompt(current => syncPromptPanelValue(current, previousInitialPrompt.current, initialPrompt));
    previousInitialPrompt.current = initialPrompt;
  }, [initialPrompt]);

  useEffect(() => {
    setSettings(current => {
      const requestedModel = current.model || defaultModel || fallbackModel;
      const nextModel = availableModels.length
        ? (availableModels.includes(requestedModel) ? requestedModel : availableModels[0]!)
        : requestedModel;
      const options = getSizeOptions(nextModel);
      const nextSize = normalizeImageSizeSelection(current.size, nextModel, options);
      return nextModel === current.model && nextSize === current.size
        ? current
        : { ...current, model: nextModel, size: nextSize };
    });
  }, [availableModels, defaultModel]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function addReference(reference: CanvasPromptReference) {
    setPrompt(value => insertPromptReference(value.replace(/@[^@\s]*$/, ""), reference));
  }

  async function submit() {
    const value = prompt.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onGenerate(nodeId, value, selected, settings);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return <section
    className="canvas-prompt-panel nodrag"
    role="dialog"
    aria-label="节点提示词编辑器"
    onPointerDown={event => event.stopPropagation()}
    onMouseDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()}
    onWheel={event => event.stopPropagation()}
  >
    <div className="canvas-prompt-panel__topline">
      <span className="canvas-prompt-panel__eyebrow">继续创作</span>
      <button type="button" className="canvas-prompt-panel__close" onClick={onClose} aria-label="关闭提示词面板">×</button>
    </div>
    <div className="canvas-prompt-panel__modes" aria-label="创作输入方式">
      <button type="button" aria-pressed={inputMode === "text"} onClick={() => setInputMode("text")}>文字生成</button>
      <button type="button" aria-pressed={inputMode === "image"} onClick={() => setInputMode("image")}>添加图片</button>
    </div>
    {inputMode === "image" && <div className="canvas-prompt-panel__image-picker" aria-label="添加画布参考图">
      <span>选择画布中的图片作为参考</span>
      <div>{candidates.filter(candidate => candidate.kind === "image").slice(0, 8).map(candidate => <button key={candidate.id} type="button" className={selected.some(item => item.id === candidate.id) ? "is-selected" : ""} onClick={() => addReference(candidate)}>
        {candidate.previewUrl ? <img src={candidate.previewUrl} alt="" aria-hidden loading="lazy" /> : <span>图</span>}
        <small>{candidate.title}</small>
      </button>)}</div>
    </div>}
    <div className="canvas-prompt-panel__tokens" aria-label="已引用内容">
      {tokens.filter(token => token.type === "reference").map(token => token.type === "reference" && (
        <span className="canvas-prompt-chip" key={`${token.reference.id}-${token.value}`}>
          {token.reference.kind === "image" ? "图" : "字"} {token.reference.title}
        </span>
      ))}
      {!selected.length && <span className="canvas-prompt-panel__hint">用 @ 引用画布中的图片或文本节点</span>}
    </div>
    <div className="canvas-prompt-panel__editor">
      <CanvasPromptChipInput value={prompt} references={candidates} onChange={setPrompt} onSubmit={() => void submit()} ariaLabel="节点提示词" placeholder={inputMode === "image" ? "补充图片修改要求，或选择参考图" : "描述下一张图，输入 @ 可引用画布节点"} />
      <span className="canvas-prompt-panel__count">{prompt.length} / 12000</span>
    </div>
    <div className="canvas-prompt-panel__settings">
      <CanvasSelect label="模型" value={settings.model} ariaLabel="生成模型" options={modelOptions} onChange={value => setSettings(current => {
        const options = getSizeOptions(value);
        return { ...current, model: value, size: normalizeImageSizeSelection(current.size, value, options) };
      })} />
      <CanvasSelect label="比例" value={settings.size} ariaLabel="图片比例" options={sizeOptions} onChange={value => setSettings(current => ({ ...current, size: value }))} />
      <CanvasSelect label="数量" value={String(settings.count)} ariaLabel="生成数量" options={[1, 2, 3, 4, 5].map(count => ({ value: String(count), label: `${count} 张` }))} onChange={value => setSettings(current => ({ ...current, count: Number(value) }))} />
      <button type="button" className="canvas-prompt-panel__submit" disabled={busy || !prompt.trim()} onClick={() => void submit()}>{busy ? "生成中…" : "生成变体"}</button>
    </div>
  </section>;
}

function CanvasSelect({ label, value, options, ariaLabel, onChange }: { label?: string; value: string; options: Array<{ value: string; label: string }>; ariaLabel: string; onChange: (value: string) => void }) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value) || options[0];
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
    const frame = requestAnimationFrame(() => menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[selectedIndex]?.focus());
    const dismiss = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open, selectedIndex]);

  function focusOption(index: number) {
    const next = (index + options.length) % options.length;
    setActiveIndex(next);
    menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[next]?.focus();
  }

  function close(refocus = false) {
    setOpen(false);
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(event.key === "ArrowDown" ? selectedIndex : Math.max(0, options.length - 1));
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return <div ref={rootRef} className={`canvas-select${open ? " is-open" : ""}`}>
    {label && <span className="canvas-select__label">{label}</span>}
    <button ref={triggerRef} type="button" className="canvas-select__trigger" aria-label={ariaLabel} aria-haspopup="menu" aria-controls={menuId} aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={handleTriggerKeyDown}><span>{current?.label}</span><span aria-hidden="true">⌄</span></button>
    {open && <div ref={menuRef} id={menuId} className="canvas-select__menu" role="menu" aria-label={ariaLabel} onKeyDown={handleMenuKeyDown}>
      {options.map((option, index) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === value} tabIndex={index === activeIndex ? 0 : -1} onFocus={() => setActiveIndex(index)} onClick={() => { onChange(option.value); close(true); }}>{option.label}{option.value === value && <span aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}
