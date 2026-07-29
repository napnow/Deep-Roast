"use client";

import { useState, useEffect, useRef } from "react";
import { formatTime } from "./imageUtils";

interface Img2ImgPanelProps {
  size: string;
  generating: boolean;
  onGenerate: (prompt: string, size: string) => void;
  onStopGenerate: () => void;
}

export default function Img2ImgPanel({
  size,
  generating,
  onGenerate,
  onStopGenerate,
}: Img2ImgPanelProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [edit, setEdit] = useState("");
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genRef = useRef(false);

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

  async function handleGenerate() {
    if (!base64 || generating) return;
    setError("");
    setProcessing(true);
    setAnalyzing(true);
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
        setAnalyzing(false);
        return;
      }
      const data = await res.json();
      setAnalyzing(false);
      genRef.current = true;
      onGenerate(data.prompt, size);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("已停止");
      } else {
        setError("网络错误");
      }
      setProcessing(false);
      setAnalyzing(false);
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

      {preview && (
        <>
          <textarea
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
            placeholder="描述你想要的改动，例如：改成赛博朋克风格、换成油画风格、把背景变成海边日落…"
            rows={2}
            disabled={processing}
            className="w-full rounded-xl px-3.5 py-2.5 text-xs resize-none transition-all duration-200 disabled:opacity-40"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />

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
                disabled={!base64 || generating}
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
      )}

      {error && (
        <p className="text-[11px] animate-fade-in" style={{ color: "var(--danger)" }}>
          ✗ {error}
        </p>
      )}
    </div>
  );
}
