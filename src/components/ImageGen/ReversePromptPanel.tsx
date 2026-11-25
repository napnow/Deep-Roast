"use client";

import { useActionFeedback } from "@/hooks/useActionFeedback";
import { AppIcon } from "@/components/ui/icons";
import { copyText } from "@/lib/browser-actions";
import { useState, useEffect, useRef } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { createClientSessionLifecycle } from "@/lib/client-session-lifecycle";
import { formatTime, compressImageFile } from "./imageUtils";

interface ReversePromptPanelProps {
  disabled?: boolean;
  onPrompt: (prompt: string) => void;
  /** 回填后关闭工具面板（返回文生图视图） */
  onCloseToolbar?: () => void;
}

export default function ReversePromptPanel({
  disabled,
  onPrompt,
  onCloseToolbar,
}: ReversePromptPanelProps) {
  const config = useDeepRoastStore((s) => s.config);
  const reverseModel = config.reversePromptModel?.trim() || "";
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState("");
  const copy = useActionFeedback(result);
  const fileRef = useRef<HTMLInputElement>(null);
  const [requests] = useState(() => createClientSessionLifecycle());
  const userSessionVersion = useDeepRoastStore(
    (state) => state.userSessionVersion,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requests.activate();
    setPreview(null);
    setBase64(null);
    setResult("");
    setError("");
    setPrompting(false);
    return () => requests.dispose();
  }, [requests, userSessionVersion]);

  useEffect(() => {
    if (result && !prompting) {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [result, prompting]);

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
    requests.invalidate();
    const request = requests.start("upload", userSessionVersion);
    if (!request) return;
    setError("");
    setPrompting(false);
    setPreview(null);
    setBase64(null);
    setResult("");
    compressImageFile(file)
      .then((data) => {
        if (!request.isCurrent()) return;
        setBase64(data);
        const reader = new FileReader();
        const abort = () => {
          if (reader.readyState === FileReader.LOADING) reader.abort();
        };
        request.signal.addEventListener("abort", abort, { once: true });
        reader.onload = () => {
          if (request.isCurrent()) setPreview(reader.result as string);
          request.signal.removeEventListener("abort", abort);
          request.finish();
        };
        reader.onerror = () => {
          if (request.isCurrent()) setError("读取图片失败");
          request.signal.removeEventListener("abort", abort);
          request.finish();
        };
        reader.readAsDataURL(file);
      })
      .catch(() => {
        if (request.isCurrent()) setError("读取图片失败");
        request.finish();
      });
    e.target.value = "";
  }

  async function handleReverse() {
    if (!base64 || disabled) return;
    const request = requests.start("reverse", userSessionVersion);
    if (!request) return;
    setError("");
    setPrompting(true);
    try {
      const res = await fetch("/api/reverse-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
        signal: request.signal,
      });
      if (!request.isCurrent()) return;
      const data = await res.json();
      if (!request.isCurrent()) return;
      if (!res.ok) {
        setError(data.error || "分析失败");
        return;
      }
      const prompt = typeof data.prompt === "string" ? data.prompt : "";
      setResult(prompt);
    } catch {
      if (request.isCurrent()) setError("网络错误");
    } finally {
      if (request.isCurrent()) setPrompting(false);
      request.finish();
    }
  }

  function handleStop() {
    requests.cancel("reverse");
    setPrompting(false);
    setError("已停止分析");
  }

  function clearUpload() {
    requests.invalidate();
    setPreview(null);
    setBase64(null);
    setError("");
    setPrompting(false);
    setResult("");
  }

  return (
    <div className="reverse-prompt-panel max-w-2xl space-y-3 py-1">
      <div className="reverse-prompt-panel__heading flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
          图片反推提示词
        </span>
        {reverseModel ? (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium font-mono max-w-[14rem] truncate"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
            title={reverseModel}
          >
            {reverseModel}
          </span>
        ) : null}
      </div>

      <div className="reverse-mobile-upload-card flex flex-wrap items-center gap-3 rounded-2xl border p-3" style={{ background: "var(--bg-root)", borderColor: "var(--border)" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {preview && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="上传的图片"
              className="w-16 h-16 rounded-xl object-cover border"
              style={{ borderColor: "var(--border-strong)" }}
            />
            {!prompting && (
              <button
                type="button"
                onClick={clearUpload}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: "var(--danger)", color: "#fff" }}
                title="清除"
                aria-label="清除上传图片"
              >
                <AppIcon name="close" size={11} strokeWidth={2.4} />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || prompting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-40"
            style={{
              background: preview ? "var(--bg-surface)" : "var(--text-primary)",
              border: `1px solid ${preview ? "var(--border-strong)" : "var(--text-primary)"}`,
              color: preview ? "var(--text-primary)" : "var(--bg-surface)",
            }}
          >
            <AppIcon name="image" size={14} />
            {preview ? "更换图片" : "选择图片"}
          </button>

          {preview && !prompting && (
            <button
              type="button"
              onClick={handleReverse}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95"
              style={{
                background: "var(--text-primary)",
                border: "1px solid var(--text-primary)",
                color: "var(--bg-surface)",
              }}
            >
              <AppIcon name="sparkles" size={14} />
              分析图片
            </button>
          )}
        </div>

        {!preview && (
          <span className="reverse-upload-hint text-xs text-[var(--text-muted)]">
            上传一张参考图，自动解析构图、光影与风格描述词
          </span>
        )}
      </div>

      {prompting && preview && (
        <div className="flex items-center gap-2.5 px-1">
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
          <span className="text-xs text-[var(--accent)]">
            正在分析图片… {formatTime(elapsed)}
          </span>
          <button
            type="button"
            onClick={handleStop}
            className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
            style={{
              background: "var(--danger-surface)",
              border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
              color: "var(--danger)",
            }}
          >
            停止
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs px-1 animate-fade-in text-[var(--danger)]">
          {error}
        </p>
      )}

      {result && !prompting && (
        <div
          ref={resultRef}
          className="rounded-2xl p-3.5 space-y-2.5 animate-fade-in"
          style={{
            background: "var(--bg-root)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-[var(--accent)]">
              反推提示词结果
            </span>
            <button
              type="button"
              onClick={() => setResult("")}
              className="inline-flex items-center gap-1 text-[11px] transition-colors hover:text-[var(--text-primary)] text-[var(--text-muted)]"
            >
              清除
            </button>
          </div>
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={4}
            className="w-full rounded-xl px-3 py-2 text-xs leading-relaxed resize-none"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onPrompt(result);
                onCloseToolbar?.();
              }}
              className="flex-1 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150 active:scale-[0.98]"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-surface)",
              }}
            >
              使用此提示词生成
            </button>
            <button
              type="button"
              disabled={copy.status === "pending"}
              aria-busy={copy.status === "pending"}
              onClick={() => {
                void copy.run(() => copyText(result), "反推提示词已复制");
              }}
              className="px-4 py-2 rounded-full text-xs font-medium transition-all duration-150 active:scale-[0.98]"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-secondary)",
              }}
            >
              {copy.status === "pending"
                ? "正在复制…"
                : copy.status === "success"
                  ? "已复制"
                  : "复制"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
