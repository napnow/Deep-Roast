"use client";

import { useState, useEffect, useRef } from "react";
import { formatTime, compressImageFile } from "./imageUtils";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";
import type { EditStyle } from "@/types";
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
  onGenerate: (prompt: string, size: string) => void;
  /** 图生图：原图直传编辑，支持多张参考图（最多 5 张）；提供时优先使用 */
  onEditImage?: (images: string[], prompt: string, size: string) => void;
  /** 图生图批量：最多 5 张 */
  onEditImageBatch?: (
    images: string[],
    prompt: string,
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
  onGenerate,
  onEditImage,
  onEditImageBatch,
  onStopGenerate,
}: Img2ImgPanelProps) {
  const [refs, setRefs] = useState<RefImage[]>([]);
  const [edit, setEdit] = useState("");
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

  /** 编译最终编辑 prompt：风格前缀（填槽） + 用户描述 */
  function compileEditPrompt(): string {
    const userDesc = edit.trim() || "生成这张图的变体";
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
      setElapsed(0);
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
            setRefs((prev) =>
              prev.length >= MAX_REFS ? prev : [...prev, { preview, base64: data }],
            );
          })
          .catch(() => setError("读取图片失败"));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeRef(idx: number) {
    setRefs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerate() {
    if (refs.length === 0 || generating) return;
    setError("");
    setProcessing(true);
    setAnalyzing(false);

    if (onEditImage) {
      // 新链路：原图直传编辑（支持多张参考图；保留构图/主体，风格前缀 + 用户描述）
      // 标记已提交：等 generating 结束由 useEffect 清理面板
      genRef.current = true;
      // 注意：这里不 setProcessing(false)！让 processing 保持 true，
      // 禁用按钮直到父级 generating 接管（防重复点击生成多张）
      const imageData = refs.map((r) => r.base64 || r.preview);
      if (batchCount > 1 && onEditImageBatch) {
        // 批量：同参考图（可多张）生成多张变体
        onEditImageBatch(imageData, compileEditPrompt(), editSize, batchCount);
      } else {
        onEditImage(imageData, compileEditPrompt(), editSize);
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
          disabled={processing || generating || refs.length >= MAX_REFS}
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
              {batchCount > 1 ? `共 ${batchCount * 5} 积分` : "每张 5 积分"}
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
                disabled={refs.length === 0 || generating || processing}
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
