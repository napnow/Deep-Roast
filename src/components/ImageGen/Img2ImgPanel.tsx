"use client";

import { useState, useEffect, useRef } from "react";
import { formatTime, compressImageFile } from "./imageUtils";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";
import type { EditStyle } from "@/types";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import {
  buildImageEditRequest,
  type ImageEditUiState,
} from "./image-edit-ui";
import {
  getActiveEditPrompt,
  getCreationSettingsSummary,
} from "./creation-workbench-ui";
import {
  EDIT_STYLE_PRESETS,
  DEFAULT_EDIT_STYLE,
  friendlyStyleColor,
  friendlyStyleTexture,
  toEditStylePreset,
  type EditStylePreset,
} from "./editStyles";

interface Img2ImgPanelProps {
  size: string;
  /** 可选比例列表（与文生图一致：1:1 / 9:16 / 16:9 等） */
  sizeOptions?: { value: string; label: string }[];
  generating: boolean;
  disabled?: boolean;
  onGenerate: (prompt: string, size: string) => void;
  /** 图生图：按结构化任务提交编辑 */
  onEditImage?: (request: ImageEditRequest, size: string) => void;
  /** 图生图批量：按结构化任务生成多个变体 */
  onEditImageBatch?: (
    request: ImageEditRequest,
    size: string,
    count: number,
  ) => void;
  onStopGenerate: () => void;
}

/** 单张参考图：preview 为原图（缩略图展示），base64 为压缩后提交数据 */
interface RefImage {
  preview: string;
  base64: string;
}

const MAX_REFS = 5;

export default function Img2ImgPanel({
  size,
  sizeOptions,
  generating,
  disabled = false,
  onGenerate,
  onEditImage,
  onEditImageBatch,
  onStopGenerate,
}: Img2ImgPanelProps) {
  const [refs, setRefs] = useState<RefImage[]>([]);
  const [edit, setEdit] = useState("");
  const [editMode, setEditMode] =
    useState<ImageEditUiState["mode"]>("per-image");
  const [perImagePrompts, setPerImagePrompts] = useState<string[]>([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [referenceIndexes, setReferenceIndexes] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  // 图生图独立比例（默认与父级一致，面板内可单独切换）
  const [editSize, setEditSize] = useState(size);
  // 批量数量（1 = 单张；2-5 = 批量变体）
  const [batchCount, setBatchCount] = useState(1);
  // 风格预设：默认不开启，用户自行选择
  const [styleId, setStyleId] = useState<string>("");
  const [styleColor, setStyleColor] = useState<string>("");
  const [styleTexture, setStyleTexture] = useState<string>("");
  // 风格列表：优先读数据库公开风格；加载失败时回落硬编码预设
  const [styles, setStyles] = useState<EditStylePreset[]>(EDIT_STYLE_PRESETS);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/styles")
      .then((res) => res.json())
      .then((data: { styles?: EditStyle[] }) => {
        if (cancelled) return;
        const rows = data.styles || [];
        if (rows.length > 0) setStyles(rows.map(toEditStylePreset));
      })
      .catch(() => {
        // 数据库不可用时沿用硬编码预设
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeStyle: EditStylePreset | undefined = styles.find(
    (s) => s.id === styleId,
  );
  const activeTaskCount = editMode === "reference" ? 1 : refs.length;
  const activeEditPrompt = getActiveEditPrompt(perImagePrompts, targetIndex);
  const currentPrompt = editMode === "per-image" && refs.length > 0
    ? activeEditPrompt
    : edit;
  const currentSizeLabel =
    sizeOptions?.find((option) => option.value === editSize)?.label || editSize;
  const settingsSummary = getCreationSettingsSummary({
    styleLabel: activeStyle?.label,
    sizeLabel: currentSizeLabel,
    batchCount,
  });

  /** 编译最终编辑 prompt：风格前缀（填槽） + 用户描述 */
  function compileEditPrompt(description = edit): string {
    const userDesc = description.trim() || "生成这张图的变体";
    if (!activeStyle) return userDesc;
    let prefix = activeStyle.prefix;
    const color =
      styleColor ||
      activeStyle.colors?.[0] ||
      "fully saturated cobalt-blue";
    const texture =
      styleTexture ||
      activeStyle.textures?.[0] ||
      "risograph grain";
    prefix = prefix.replace("{color}", color).replace("{texture}", texture);
    return `${prefix}\n\n用户的修改要求：${userDesc}`;
  }

  useEffect(() => {
    if (processing) {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [processing]);

  useEffect(() => {
    if (genRef.current && !generating) {
      genRef.current = false;
      setProcessing(false);
      setRefs([]);
      setEdit("");
      setPerImagePrompts([]);
      setEditMode("per-image");
      setTargetIndex(0);
      setReferenceIndexes([]);
    }
  }, [generating]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    abortRef.current?.abort();
    setError("");
    setProcessing(false);
    setAnalyzing(false);
    // 新上传时重置风格色/纹理（保留风格选择）
    setStyleColor("");
    setStyleTexture("");

    const room = MAX_REFS - refs.length;
    if (room <= 0) {
      setError(`参考图最多 ${MAX_REFS} 张`);
      e.target.value = "";
      return;
    }
    const picked = files.slice(0, room);
    if (picked.length < files.length) {
      setError(`参考图最多 ${MAX_REFS} 张，已忽略多余的 ${files.length - picked.length} 张`);
    }

    picked.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const preview = reader.result as string;
        // 压缩后用于编辑请求（避免大图撞 body 限制；预览用原图）
          compressImageFile(file, 1536, 0.9)
            .then((data) => {
            setRefs((prev) => {
              if (prev.length >= MAX_REFS) return prev;
              setPerImagePrompts((prompts) => [...prompts, ""]);
              return [...prev, { preview, base64: data }];
            });
          })
          .catch(() => setError("读取图片失败"));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeRef(idx: number) {
    setRefs((prev) => prev.filter((_, i) => i !== idx));
    setPerImagePrompts((prev) => prev.filter((_, i) => i !== idx));
    setReferenceIndexes((prev) =>
      prev
        .filter((index) => index !== idx)
        .map((index) => (index > idx ? index - 1 : index)),
    );
    setTargetIndex((prev) => {
      if (prev === idx) return Math.max(0, Math.min(prev, refs.length - 2));
      return prev > idx ? prev - 1 : prev;
    });
  }

  function toggleEditMode(mode: ImageEditUiState["mode"]) {
    setEditMode(mode);
    if (mode === "reference") {
      setReferenceIndexes((prev) =>
        prev.filter((index) => index >= 0 && index < refs.length && index !== targetIndex),
      );
    }
  }

  function toggleReference(index: number) {
    if (index === targetIndex) return;
    setReferenceIndexes((prev) =>
      prev.includes(index)
        ? prev.filter((item) => item !== index)
        : [...prev, index],
    );
  }

  function updateCurrentPrompt(value: string) {
    if (editMode === "per-image" && refs.length > 0) {
      setPerImagePrompts((prev) => {
        const next = [...prev];
        next[targetIndex] = value;
        return next;
      });
      return;
    }
    setEdit(value);
  }

  async function handleGenerate() {
    if (disabled || refs.length === 0 || generating) return;
    setError("");
    setElapsed(0);
    setProcessing(true);
    setAnalyzing(false);

    if (onEditImage) {
      // 新链路：原图直传编辑（支持多张参考图；保留构图/主体，风格前缀 + 用户描述）
      // 标记已提交：等 generating 结束由 useEffect 清理面板
      genRef.current = true;
      // 注意：这里不 setProcessing(false)！让 processing 保持 true，
      // 禁用按钮直到父级 generating 接管（防重复点击生成多张）
      const imageData = refs.map((r) => r.base64 || r.preview);
      const uiState: ImageEditUiState =
        editMode === "reference"
          ? { mode: "reference", targetIndex, referenceIndexes }
          : {
              mode: "per-image",
              prompts: perImagePrompts.map((prompt) =>
                prompt.trim() ? compileEditPrompt(prompt) : "",
              ),
            };
      const request = buildImageEditRequest(
        imageData,
        uiState,
        compileEditPrompt(),
      );
      if (
        request.mode === "reference" &&
        request.referenceImages?.length === 0
      ) {
        setError("参考修改至少需要选择一张参考图");
        setProcessing(false);
        genRef.current = false;
        return;
      }
      if (batchCount > 1 && onEditImageBatch) {
        onEditImageBatch(request, editSize, batchCount);
      } else {
        onEditImage(request, editSize);
      }
      return;
    }

    // 兜底：无 onEditImage 时走旧反推链路（正常情况下不会到这里）
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch("/api/reverse-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: refs[0].base64 || refs[0].preview,
          editDescription: edit.trim() || "生成这张图的变体",
        }),
        signal: abort.signal,
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "分析失败");
        setProcessing(false);
        return;
      }
      const data = await res.json();
      onGenerate(data.prompt, editSize);
      setProcessing(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("已停止");
      } else {
        setError("网络错误");
      }
      setProcessing(false);
    }
  }

  function handleStop() {
    if (analyzing) {
      abortRef.current?.abort();
    } else {
      onStopGenerate();
    }
    setProcessing(false);
    setAnalyzing(false);
  }

  function clearAll() {
    abortRef.current?.abort();
    setRefs([]);
    setEdit("");
    setPerImagePrompts([]);
    setEditMode("per-image");
    setTargetIndex(0);
    setReferenceIndexes([]);
    setError("");
    setProcessing(false);
    setAnalyzing(false);
  }

  return (
    <div className="img2img-workbench">
      <div className="img2img-workbench__heading">
        <div>
          <span className="ui-kicker">图生图</span>
          <p className="img2img-workbench__subtitle">上传素材，选择目标后描述修改</p>
        </div>
        <span className="img2img-workbench__count">{refs.length}/{MAX_REFS}</span>
      </div>

      {disabled ? (
        <p className="creation-status creation-status--warning">
          生图功能暂时关闭
        </p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      <section
        className="img2img-assets creation-step-card img2img-mobile-step img2img-mobile-assets"
        aria-labelledby="img2img-assets-title"
      >
        <div className="img2img-assets__toolbar">
          <div className="creation-step-card__heading">
            <span className="creation-step-card__number" aria-hidden="true">01</span>
            <div>
              <h2 id="img2img-assets-title" className="creation-step-card__title">
                参考素材
              </h2>
              <p className="creation-step-card__description">
                上传图片，选择目标后描述修改
              </p>
            </div>
            <span className="img2img-assets__count">
              {refs.length} / {MAX_REFS}
            </span>
          </div>
          {refs.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              disabled={processing}
              className="creation-link"
            >
              清空全部
            </button>
          ) : null}
        </div>

        <div className="img2img-assets__rail">
          {refs.map((ref, idx) => {
            const selected =
              editMode === "reference"
                ? targetIndex === idx || referenceIndexes.includes(idx)
                : targetIndex === idx;
            const role =
              editMode === "reference"
                ? targetIndex === idx
                  ? "目标图"
                  : referenceIndexes.includes(idx)
                    ? "参考图"
                    : "选择"
                : targetIndex === idx
                  ? "当前编辑"
                  : "图片 " + (idx + 1);

            return (
              <div
                key={idx}
                className={"img2img-asset " + (selected ? "is-selected" : "")}
              >
                <button
                  type="button"
                  className="img2img-asset__preview"
                  onClick={() => {
                    setTargetIndex(idx);
                    if (editMode === "reference") {
                      setReferenceIndexes((prev) =>
                        prev.filter((index) => index !== idx),
                      );
                    }
                  }}
                  disabled={processing}
                  aria-label={"选择图片 " + (idx + 1)}
                  aria-pressed={selected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.preview || ref.base64}
                    alt={"参考图 " + (idx + 1)}
                    className="img2img-asset__image"
                  />
                  <span className="img2img-asset__index">{idx + 1}</span>
                  <span className="img2img-asset__role">{role}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeRef(idx)}
                  disabled={processing}
                  className="img2img-asset__remove"
                  title="删除此图"
                  aria-label={"删除参考图 " + (idx + 1)}
                >
                  ×
                </button>
                {editMode === "reference" && targetIndex !== idx ? (
                  <button
                    type="button"
                    onClick={() => toggleReference(idx)}
                    disabled={processing}
                    className="img2img-asset__reference-toggle"
                  >
                    {referenceIndexes.includes(idx) ? "取消参考" : "设为参考"}
                  </button>
                ) : null}
              </div>
            );
          })}

          {refs.length < MAX_REFS ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || processing || generating}
              className="img2img-add-card"
            >
              <span className="img2img-add-card__icon">+</span>
              <span>{refs.length > 0 ? "继续添加" : "添加参考图"}</span>
            </button>
          ) : null}
        </div>

        <p className="img2img-assets__hint">
          {refs.length === 0
            ? "最多上传 5 张图片，可分别修改或指定一张参考修改"
            : editMode === "reference"
              ? "点击图片设为目标，再将其他图片设为参考"
              : "点击图片切换当前编辑对象"}
        </p>
      </section>

      {refs.length > 0 ? (
        <section
          className="img2img-task creation-task-card img2img-mobile-step img2img-mobile-task"
          aria-label="图生图任务"
        >
          <div className="creation-step-card__heading">
            <span className="creation-step-card__number" aria-hidden="true">02</span>
            <div>
              <h2 className="creation-step-card__title">修改任务</h2>
              <p className="creation-step-card__description">
                选择分别修改，或让一张图参考另一张图
              </p>
            </div>
          </div>
          <div className="img2img-task__header">
            <div className="creation-segmented" role="tablist" aria-label="处理方式">
              {(
                [
                  ["per-image", "分别修改"],
                  ["reference", "参考修改"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={editMode === mode}
                  onClick={() => toggleEditMode(mode)}
                  disabled={processing}
                  className={editMode === mode ? "is-active" : ""}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="img2img-task__mode-copy">
              {editMode === "reference" ? "一张目标图 + 多张参考图" : "逐张编辑"}
            </span>
          </div>

          {editMode === "per-image" ? (
            <label className="img2img-current-editor">
              <span className="creation-section-label">当前编辑</span>
              <select
                value={targetIndex}
                onChange={(event) => setTargetIndex(Number(event.target.value))}
                disabled={processing}
                className="img2img-current-editor__select"
              >
                {refs.map((_, idx) => (
                  <option key={idx} value={idx}>
                    图片 {idx + 1}
                  </option>
                ))}
              </select>
              <span className="img2img-current-editor__count">
                {activeEditPrompt.trim() ? "已填写专属指令" : "使用公共要求"}
              </span>
            </label>
          ) : (
            <div className="img2img-role-summary">
              <span className="creation-section-label">编辑关系</span>
              <span>目标图：图片 {targetIndex + 1}</span>
              <span>参考图：{referenceIndexes.length} 张</span>
            </div>
          )}

          <label className="creation-composer">
            <span className="creation-section-label">
              {editMode === "reference"
                ? "描述参考修改"
                : "图片 " + (targetIndex + 1) + " 的修改指令"}
            </span>
            <textarea
              value={currentPrompt}
              onChange={(event) => updateCurrentPrompt(event.target.value)}
              onFocus={lockPageScroll}
              onBlur={unlockPageScroll}
              placeholder={
                editMode === "reference"
                  ? "描述你想要的修改…"
                  : "例如：把背景改成海边日落，保留主体不变…"
              }
              rows={4}
              disabled={processing}
              className="creation-composer__input"
            />
            <span className="creation-composer__counter">
              {currentPrompt.length} / 1000
            </span>
          </label>

          {editMode === "per-image" ? (
            <details className="img2img-shared-prompt">
              <summary>所有图片的共同要求（可选）</summary>
              <textarea
                value={edit}
                onChange={(event) => setEdit(event.target.value)}
                onFocus={lockPageScroll}
                onBlur={unlockPageScroll}
                placeholder="例如：整体保持原构图，只统一色调…"
                rows={2}
                disabled={processing}
                className="img2img-shared-prompt__input"
              />
            </details>
          ) : null}
        </section>
      ) : (
        <label className="creation-composer creation-composer--empty">
          <span className="creation-section-label">修改要求</span>
          <textarea
            value={edit}
            onChange={(event) => setEdit(event.target.value)}
            onFocus={lockPageScroll}
            onBlur={unlockPageScroll}
            placeholder="上传参考图后，描述你想要的修改…"
            rows={4}
            disabled={processing}
            className="creation-composer__input"
          />
          <span className="creation-composer__counter">{edit.length} / 1000</span>
        </label>
      )}

      <details className="creation-settings creation-step-card">
        <summary>
          <span className="creation-step-card__summary">
            <span className="creation-step-card__number" aria-hidden="true">03</span>
            <span>
              <span className="creation-settings__title">更多设置</span>
              <span className="creation-step-card__description">
                风格、比例与生成数量
              </span>
            </span>
          </span>
          <span className="creation-settings__summary">
            {settingsSummary.length > 0
              ? settingsSummary.join(" · ")
              : "风格、比例、数量"}
          </span>
        </summary>
        <div className="creation-settings__body">
          <section className="creation-setting-group">
            <div className="creation-setting-group__header">
              <span className="creation-section-label">风格</span>
              <button
                type="button"
                onClick={() =>
                  setStyleId(styleId === "" ? DEFAULT_EDIT_STYLE : "")
                }
                disabled={processing}
                className="creation-link"
              >
                {styleId === "" ? "开启风格" : "不使用风格"}
              </button>
            </div>
            <div className="creation-chip-list">
              {styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStyleId(style.id)}
                  disabled={processing}
                  className={
                    styleId === style.id
                      ? "creation-chip is-selected"
                      : "creation-chip"
                  }
                >
                  {style.label}
                </button>
              ))}
            </div>

            {activeStyle?.colors ? (
              <div className="creation-setting-options">
                <span className="creation-setting-options__label">主色</span>
                {activeStyle.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setStyleColor(color)}
                    disabled={processing}
                    className={
                      styleColor === color ||
                      (!styleColor && color === activeStyle.colors?.[0])
                        ? "creation-chip is-selected"
                        : "creation-chip"
                    }
                  >
                    {friendlyStyleColor(color)}
                  </button>
                ))}
              </div>
            ) : null}

            {activeStyle?.textures ? (
              <div className="creation-setting-options">
                <span className="creation-setting-options__label">纹理</span>
                {activeStyle.textures.map((texture) => (
                  <button
                    key={texture}
                    type="button"
                    onClick={() => setStyleTexture(texture)}
                    disabled={processing}
                    className={
                      styleTexture === texture ||
                      (!styleTexture && texture === activeStyle.textures?.[0])
                        ? "creation-chip is-selected"
                        : "creation-chip"
                    }
                  >
                    {friendlyStyleTexture(texture)}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {sizeOptions && sizeOptions.length > 0 ? (
            <section className="creation-setting-group">
              <span className="creation-section-label">比例</span>
              <div className="creation-chip-list">
                {sizeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEditSize(option.value)}
                    disabled={processing}
                    className={
                      editSize === option.value
                        ? "creation-chip is-selected"
                        : "creation-chip"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="creation-setting-group">
            <span className="creation-section-label">生成数量</span>
            <div className="creation-chip-list">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setBatchCount(count)}
                  disabled={processing}
                  className={
                    batchCount === count
                      ? "creation-chip is-selected"
                      : "creation-chip"
                  }
                >
                  {count} 张
                </button>
              ))}
            </div>
            <p className="creation-setting-hint">
              {batchCount > 1
                ? "共 " + batchCount * activeTaskCount * 5 + " 积分"
                : editMode === "reference"
                  ? "参考模式每张 5 积分"
                  : "预计 " + activeTaskCount * 5 + " 积分"}
            </p>
          </section>
        </div>
      </details>

      <div className="img2img-action">
        {processing ? (
          <>
            <span className="img2img-action__progress" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="img2img-action__status">
              {analyzing
                ? "正在分析图片… "
                : "正在生成图片… "}
              {formatTime(elapsed)}
            </span>
            <button type="button" onClick={handleStop} className="ui-button ui-button--danger">
              停止生成
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled || refs.length === 0 || generating || processing}
            className="ui-button ui-button--primary"
          >
            生成图片
          </button>
        )}
      </div>

      {error ? (
        <p className="creation-status creation-status--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
