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
    <div className="max-w-2xl space-y-3">
      <span
        className="text-[11px] font-semibold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        图生图
      </span>

      {disabled ? (
        <p
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            color: "var(--accent)",
            background: "var(--accent-surface)",
            border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
        >
          生图功能暂时关闭
        </p>
      ) : null}

      <div className="flex items-center gap-2.5 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || processing || generating || refs.length >= MAX_REFS}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:scale-100"
          style={{
            background: "var(--accent-surface)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          {refs.length > 0 ? "添加参考图" : "选择参考图"}
          <span className="opacity-70">({refs.length}/{MAX_REFS})</span>
        </button>

        {refs.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {refs.map((r, idx) => (
                <div key={idx} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.preview || r.base64}
                    alt={`参考图 ${idx + 1}`}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <button
                    onClick={() => removeRef(idx)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] hover:scale-110 transition-transform"
                    style={{ background: "var(--danger)", color: "#fff" }}
                    title="删除此图"
                    aria-label={`删除参考图 ${idx + 1}`}
                  >
                    ✕
                  </button>
                  {editMode === "per-image" ? (
                    <textarea
                      value={perImagePrompts[idx] || ""}
                      onChange={(event) =>
                        setPerImagePrompts((prev) => {
                          const next = [...prev];
                          next[idx] = event.target.value;
                          return next;
                        })
                      }
                      onFocus={lockPageScroll}
                      onBlur={unlockPageScroll}
                      rows={2}
                      disabled={processing}
                      placeholder={"图片 " + (idx + 1) + " 的修改指令"}
                      className="mt-1 w-24 rounded-md px-1.5 py-1 text-[10px] resize-y disabled:opacity-40"
                      style={{
                        background: "var(--bg-root)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  ) : (
                    <div className="mt-1 flex flex-col gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetIndex(idx);
                          setReferenceIndexes((prev) =>
                            prev.filter((index) => index !== idx),
                          );
                        }}
                        disabled={processing}
                        className="rounded-md px-1.5 py-1 text-left disabled:opacity-40"
                        style={{
                          background:
                            targetIndex === idx
                              ? "var(--accent-surface)"
                              : "var(--bg-root)",
                          border:
                            targetIndex === idx
                              ? "1px solid var(--accent)"
                              : "1px solid var(--border)",
                          color:
                            targetIndex === idx
                              ? "var(--accent)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {targetIndex === idx ? "目标图" : "设为目标"}
                      </button>
                      <label
                        className="flex items-center gap-1 px-1.5 py-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <input
                          type="checkbox"
                          checked={referenceIndexes.includes(idx)}
                          onChange={() => toggleReference(idx)}
                          disabled={processing || targetIndex === idx}
                        />
                        参考图
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={clearAll}
              className="text-[11px] transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              清空全部
            </button>
          </>
        )}
      </div>

      {refs.length > 0 && (
        <div
          className="rounded-xl px-3 py-2.5 space-y-2"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold tracking-widest uppercase mr-1"
              style={{ color: "var(--text-muted)" }}
            >
              处理方式
            </span>
            {(
              [
                ["per-image", "分别修改"],
                ["reference", "参考修改"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => toggleEditMode(mode)}
                disabled={processing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40"
                style={{
                  background:
                    editMode === mode
                      ? "var(--accent-surface)"
                      : "var(--bg-root)",
                  border:
                    editMode === mode
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                  color:
                    editMode === mode
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {editMode === "reference" && (
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              选择一张目标图，再勾选一张或多张参考图。参考修改当前仅支持 GPT Image 2。
            </p>
          )}
        </div>
      )}

      {/* 描述/风格/比例/生成：始终显示（上传图片只是填充参考图） */}
      <>
        <textarea
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
            onFocus={lockPageScroll}
            onBlur={unlockPageScroll}
            placeholder="描述你想要的改动（可选），例如：改成赛博朋克风格、把背景变成海边日落…"
            rows={5}
            disabled={processing}
            className="w-full rounded-xl px-3.5 py-2.5 text-xs resize-y transition-all duration-200 disabled:opacity-40"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              minHeight: "6rem",
            }}
          />

          {/* 风格预设 */}
          <div className="rounded-xl px-3 py-2.5 space-y-2.5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                风格
              </span>
              <button
                type="button"
                onClick={() => setStyleId(styleId === "" ? DEFAULT_EDIT_STYLE : "")}
                className="text-[10px] transition-colors hover:opacity-80"
                style={{ color: styleId === "" ? "var(--accent)" : "var(--text-muted)" }}
              >
                {styleId === "" ? "开启风格" : "不使用风格"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {styles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  disabled={processing}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:scale-100"
                  style={{
                    background: styleId === s.id ? "var(--accent-surface)" : "var(--bg-root)",
                    border: `1px solid ${styleId === s.id ? "var(--accent)" : "var(--border)"}`,
                    color: styleId === s.id ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {activeStyle?.colors && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  主色
                </span>
                {activeStyle.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStyleColor(c)}
                    disabled={processing}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 active:scale-95 disabled:opacity-40"
                    style={{
                      background:
                        styleColor === c || (!styleColor && c === activeStyle.colors?.[0])
                          ? "var(--accent-surface)"
                          : "var(--bg-root)",
                      border: `1px solid ${
                        styleColor === c || (!styleColor && c === activeStyle.colors?.[0])
                          ? "var(--accent)"
                          : "var(--border)"
                      }`,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {friendlyStyleColor(c)}
                  </button>
                ))}
              </div>
            )}

            {activeStyle?.textures && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  纹理
                </span>
                {activeStyle.textures.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setStyleTexture(t)}
                    disabled={processing}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 active:scale-95 disabled:opacity-40"
                    style={{
                      background:
                        styleTexture === t || (!styleTexture && t === activeStyle.textures?.[0])
                          ? "var(--accent-surface)"
                          : "var(--bg-root)",
                      border: `1px solid ${
                        styleTexture === t || (!styleTexture && t === activeStyle.textures?.[0])
                          ? "var(--accent)"
                          : "var(--border)"
                      }`,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {friendlyStyleTexture(t)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 图片比例（面板内独立选择） */}
          {sizeOptions && sizeOptions.length > 0 && (
            <div
              className="rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[10px] font-semibold tracking-widest uppercase shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                比例
              </span>
              <div className="flex flex-wrap gap-1.5">
                {sizeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditSize(opt.value)}
                    disabled={processing}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:scale-100"
                    style={{
                      background:
                        editSize === opt.value
                          ? "var(--accent-surface)"
                          : "var(--bg-root)",
                      border: `1px solid ${
                        editSize === opt.value
                          ? "var(--accent)"
                          : "var(--border)"
                      }`,
                      color:
                        editSize === opt.value
                          ? "var(--accent)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 批量数量：1 = 单张，2-5 = 批量变体（每张 5 积分） */}
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="text-[10px] font-semibold tracking-widest uppercase shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              数量
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBatchCount(n)}
                  disabled={processing}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:scale-100"
                  style={{
                    background:
                      batchCount === n
                        ? "var(--accent-surface)"
                        : "var(--bg-root)",
                    border: `1px solid ${
                      batchCount === n ? "var(--accent)" : "var(--border)"
                    }`,
                    color:
                      batchCount === n
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                  }}
                >
                  {n === 1 ? "1 张" : `${n} 张`}
                </button>
              ))}
            </div>
            <span
              className="text-[10px] shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {batchCount > 1
                ? "共 " + batchCount * activeTaskCount * 5 + " 积分"
                : editMode === "reference"
                  ? "参考模式每张 5 积分"
                  : "预计 " + activeTaskCount * 5 + " 积分"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {processing ? (
              <>
                <span className="flex gap-1">
                  {[0, 120, 240].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
                      style={{
                        background: "var(--accent)",
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  ))}
                </span>
                <span className="text-[11px]" style={{ color: "var(--accent)" }}>
                  {analyzing
                    ? `正在分析图片… ${formatTime(elapsed)}`
                    : `正在生成图片… ${formatTime(elapsed)}`}
                </span>
                <button
                  onClick={handleStop}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 hover:scale-105"
                  style={{
                    background: "var(--danger-surface)",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                  }}
                >
                  停止
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={disabled || refs.length === 0 || generating || processing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:scale-100"
                style={{
                  background: "var(--accent-surface)",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                }}
              >
                生成图片
              </button>
            )}
          </div>
      </>

      {error && (
        <p className="text-[11px] animate-fade-in" style={{ color: "var(--danger)" }}>
          ✗ {error}
        </p>
      )}
    </div>
  );
}
