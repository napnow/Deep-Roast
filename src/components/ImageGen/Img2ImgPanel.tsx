"use client";

import { useState, useEffect, useRef } from "react";
import { formatTime, compressImageFile } from "./imageUtils";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";
import {
  EDIT_STYLE_PRESETS,
  DEFAULT_EDIT_STYLE,
  type EditStylePreset,
} from "./editStyles";

interface Img2ImgPanelProps {
  size: string;
  /** 可选比例列表（与文生图一致：1:1 / 9:16 / 16:9 等） */
  sizeOptions?: { value: string; label: string }[];
  generating: boolean;
  onGenerate: (prompt: string, size: string) => void;
  /** 图生图：原图直传编辑；提供时优先使用 */
  onEditImage?: (image: string, prompt: string, size: string) => void;
  /** 图生图批量：最多 5 张 */
  onEditImageBatch?: (
    image: string,
    prompt: string,
    size: string,
    count: number,
  ) => void;
  onStopGenerate: () => void;
}

export default function Img2ImgPanel({
  size,
  sizeOptions,
  generating,
  onGenerate,
  onEditImage,
  onEditImageBatch,
  onStopGenerate,
}: Img2ImgPanelProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genRef = useRef(false);

  const activeStyle: EditStylePreset | undefined = EDIT_STYLE_PRESETS.find(
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
      setPreview(null);
      setBase64(null);
      setEdit("");
    }
  }, [generating]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    abortRef.current?.abort();
    setError("");
    setProcessing(false);
    setAnalyzing(false);
    setBase64(null);
    // 新上传时重置风格色/纹理（保留风格选择）
    setStyleColor("");
    setStyleTexture("");

    // 压缩后用于编辑请求（避免大图撞 body 限制；预览用原图）
    compressImageFile(file, 1536, 0.9)
      .then((data) => setBase64(data))
      .catch(() => setError("读取图片失败"));
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleGenerate() {
    if (!base64 || generating) return;
    setError("");
    setProcessing(true);
    setAnalyzing(false);

    if (onEditImage) {
      // 新链路：原图直传编辑（保留构图/主体，风格前缀 + 用户描述）
      // 标记已提交：等 generating 结束由 useEffect 清理面板
      genRef.current = true;
      // 注意：这里不 setProcessing(false)！让 processing 保持 true，
      // 禁用按钮直到父级 generating 接管（防重复点击生成多张）
      if (batchCount > 1 && onEditImageBatch) {
        // 批量：同参考图生成多张变体
        onEditImageBatch(base64, compileEditPrompt(), editSize, batchCount);
      } else {
        onEditImage(base64, compileEditPrompt(), editSize);
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
          imageBase64: base64,
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
    setPreview(null);
    setBase64(null);
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

      <div className="flex items-center gap-2.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleSelect}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={processing || generating}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:scale-100"
          style={{
            background: "var(--accent-surface)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          {preview ? "更换参考图" : "选择参考图"}
        </button>

        {preview && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="参考图"
              className="w-20 h-20 rounded-lg object-cover border"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={clearAll}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] hover:scale-110 transition-transform"
              style={{ background: "var(--danger)", color: "#fff" }}
              title="清除"
            >
              ✕
            </button>
          </div>
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
            rows={2}
            disabled={processing}
            className="w-full rounded-xl px-3.5 py-2.5 text-xs resize-none transition-all duration-200 disabled:opacity-40"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
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
              {EDIT_STYLE_PRESETS.map((s) => (
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
                    {c
                      .replace("fully saturated ", "")
                      .replace("opaque ", "")
                      .replace("vivid ", "")
                      .replace("clean ", "")
                      .replace("electric ", "")
                      .replace("vibrant ", "")
                      .replace("crimson ", "")
                      .replace("golden ", "")
                      .replace("emerald ", "")
                      .replace("hot ", "")
                      .replace("pear-", "梨")
                      .replace("magenta-pink", "品红")
                      .replace("cobalt-blue", "钴蓝")
                      .replace("ultramarine", "群青")
                      .replace("lemon-yellow", "柠檬黄")
                      .replace("tomato-red", "番茄红")
                      .replace("orange-red", "橙红")
                      .replace("electric blue", "电光蓝")
                      .replace("crimson red", "绯红")
                      .replace("golden yellow", "金黄")
                      .replace("emerald green", "祖母绿")
                      .replace("hot pink", "亮粉")
                      .replace("warm rice paper white", "暖米宣纸")
                      .replace("cool porcelain white", "冷瓷白")
                      .replace("mist gray paper", "雾灰")
                      .replace("muted celadon paper", "青瓷")
                      .replace("moonlit pale indigo paper", "月夜靛蓝")
                      .replace("light ochre paper", "浅赭")}
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
                    {t
                      .replace("risograph grain", "Riso 颗粒")
                      .replace("xerox softness", "复印柔化")
                      .replace("letterpress ink bleed", "铅印洇墨")
                      .replace("halftone degradation", "半调失真")
                      .replace("aged paper mottling", "旧纸斑驳")
                      .replace("dry-brush fracture", "飞白破墨")
                      .replace("wet wash bloom", "湿墨晕染")
                      .replace("diluted transparent ink layers", "淡墨层叠")
                      .replace("pooled pigment edge", "墨渍边缘")
                      .replace("ink-absorbed photo fragment", "墨吸照片")
                      .replace("soft photocopy grain", "柔复印颗粒")}
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
                disabled={!base64 || generating || processing}
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
