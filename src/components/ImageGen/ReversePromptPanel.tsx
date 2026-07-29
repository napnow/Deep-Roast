"use client";

import { useState, useEffect, useRef } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { formatTime } from "./imageUtils";

interface ReversePromptPanelProps {
  disabled?: boolean;
  onPrompt: (prompt: string) => void;
}

export default function ReversePromptPanel({
  disabled,
  onPrompt,
}: ReversePromptPanelProps) {
  const config = useDeepRoastStore((s) => s.config);
  const reverseModel =
    config.reversePromptModel?.trim() ||
    config.textModel?.trim() ||
    "";
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (prompting) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [prompting]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    abortRef.current?.abort();
    setError("");
    setPrompting(false);
    setBase64(null);

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      setPreview(data);
      setBase64(data);
    };
    reader.onerror = () => setError("读取图片失败");
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleReverse() {
    if (!base64) return;
    setError("");
    setPrompting(true);
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/reverse-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
        signal: abort.signal,
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "分析失败");
        setPrompting(false);
        return;
      }
      const data = await res.json();
      onPrompt(data.prompt);
      setPrompting(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("已停止分析");
      } else {
        setError("网络错误");
      }
      setPrompting(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setPrompting(false);
  }

  function clearUpload() {
    abortRef.current?.abort();
    setPreview(null);
    setBase64(null);
    setError("");
    setPrompting(false);
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          图片反推提示词
        </span>
        {reverseModel ? (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium font-mono max-w-[14rem] truncate"
            style={{
              background: "var(--bg-root)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
            title={reverseModel}
          >
            {reverseModel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || prompting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:scale-100"
          style={{
            background: "var(--accent-surface)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          {preview ? "更换图片" : "选择图片"}
        </button>

        {preview && !prompting && (
          <button
            onClick={handleReverse}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            🔍 分析图片
          </button>
        )}

        {preview && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="上传的图片"
              className="w-20 h-20 rounded-lg object-cover border"
              style={{ borderColor: "var(--border)" }}
            />
            {!prompting && (
              <button
                onClick={clearUpload}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] hover:scale-110 transition-transform"
                style={{ background: "var(--danger)", color: "#fff" }}
                title="清除"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {preview && !prompting && !error && (
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
            点击「分析图片」提取提示词
          </p>
        )}
      </div>

      {prompting && preview && (
        <div className="flex items-center gap-2.5">
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
            正在分析图片… {formatTime(elapsed)}
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
        </div>
      )}

      {error && (
        <p className="text-[11px] animate-fade-in" style={{ color: "var(--danger)" }}>
          ✗ {error}
        </p>
      )}
    </div>
  );
}
