"use client";

import { useState, useEffect, useRef } from "react";
import type { Config } from "@/types";
import { DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS } from "@/types";
import ModelManager from "@/components/Settings/ModelManager";
import ReversePromptModelPicker from "@/components/Settings/ReversePromptModelPicker";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: Config;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}

/** 管理员专属：生图/对话配置（API Key / 模型 / 系统提示词） */
export default function SettingsModal({
  open,
  onClose,
  config,
  onSave,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [textModel, setTextModel] = useState(
    config.textModel || "doubao-seed-2-0-pro-260215",
  );
  const [imageModel, setImageModel] = useState(config.imageModel);
  const [imageSystemPrompt, setImageSystemPrompt] = useState(
    config.imageSystemPrompt || "",
  );
  const [reversePromptModel, setReversePromptModel] = useState(
    config.reversePromptModel || "",
  );
  const [enabledText, setEnabledText] = useState<string[]>(
    config.enabledTextModels?.length
      ? config.enabledTextModels
      : DEFAULT_TEXT_MODELS.map((m) => m.id),
  );
  const [enabledImage, setEnabledImage] = useState<string[]>(
    config.enabledImageModels || DEFAULT_IMAGE_MODELS.map((m) => m.id),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setApiKey("");
      setBaseUrl(config.baseUrl);
      setTextModel(config.textModel || "doubao-seed-2-0-pro-260215");
      setImageModel(config.imageModel);
      setImageSystemPrompt(config.imageSystemPrompt || "");
      setReversePromptModel(config.reversePromptModel || "");
      setEnabledText(
        config.enabledTextModels?.length
          ? config.enabledTextModels
          : DEFAULT_TEXT_MODELS.map((m) => m.id),
      );
      setEnabledImage(
        config.enabledImageModels?.length
          ? config.enabledImageModels
          : DEFAULT_IMAGE_MODELS.map((m) => m.id),
      );
      setMessage("");
    }
    wasOpen.current = open;
  }, [open, config]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        baseUrl,
        textModel,
        imageModel,
        imageSystemPrompt,
        // 允许留空：运行时回落默认视觉模型
        reversePromptModel: reversePromptModel.trim(),
        enabledTextModels: enabledText,
        enabledImageModels: enabledImage,
      };
      if (apiKey.trim()) {
        payload.arkApiKey = apiKey.trim();
      }
      await onSave(payload);
      setApiKey("");
      setMessage("✓ 保存成功");
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message ? err.message : "保存失败";
      setMessage(`✗ ${msg}`);
    }
    setSaving(false);
  }

  if (!open) return null;

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  const keyPlaceholder = config.hasApiKey
    ? `已配置 ${config.apiKeyHint || "****"}，留空则不修改`
    : "输入 API Key…";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-[32rem] max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl animate-scale-in"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              ⚙️ 管理员配置
            </h2>
            <p
              className="text-[10.5px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              仅管理员可见 · 生图模型与上游设置
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <Field
            label="API Key"
            hint="此处配置优先于 .env；留空保存表示不修改已有 Key"
          >
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyPlaceholder}
              autoComplete="off"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors duration-200"
              style={inputStyle}
            />
          </Field>

          <Field
            label="API Base URL"
            hint="OpenAI 兼容地址，可只填主机（会自动补 /v1）"
          >
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com/v1"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors duration-200"
              style={inputStyle}
            />
          </Field>

          <ModelManager
            kind="text"
            enabled={enabledText}
            onChange={setEnabledText}
            defaultModel={textModel}
            onDefaultModelChange={setTextModel}
            baseUrl={baseUrl}
            apiKey={apiKey}
            hasSavedApiKey={!!config.hasApiKey}
          />

          <ModelManager
            kind="image"
            enabled={enabledImage}
            onChange={setEnabledImage}
            defaultModel={imageModel}
            onDefaultModelChange={setImageModel}
            baseUrl={baseUrl}
            apiKey={apiKey}
            hasSavedApiKey={!!config.hasApiKey}
          />

          <ReversePromptModelPicker
            value={reversePromptModel}
            onChange={setReversePromptModel}
            baseUrl={baseUrl}
            apiKey={apiKey}
            hasSavedApiKey={!!config.hasApiKey}
          />

          <Field
            label="图片生成系统提示词"
            hint="将在每次生图时自动附加到用户输入的提示词前面"
          >
            <textarea
              value={imageSystemPrompt}
              onChange={(e) => setImageSystemPrompt(e.target.value)}
              placeholder="例如：高质量、8K分辨率、构图精美、光影自然"
              rows={3}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm resize-none transition-colors duration-200"
              style={inputStyle}
            />
          </Field>

          {message && (
            <p
              className="text-xs font-medium animate-fade-in"
              style={{
                color: message.includes("✓")
                  ? "var(--success)"
                  : "var(--danger)",
              }}
            >
              {message}
            </p>
          )}
        </div>

        <div
          className="px-5 py-3 border-t flex justify-end gap-3 shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 hover:scale-105"
            style={{ color: "var(--text-muted)" }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 hover:scale-105 disabled:opacity-40 disabled:scale-100"
            style={{
              background: "var(--accent-surface)",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="text-[11px] font-semibold"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
