"use client";

import { useState, useEffect, useRef } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import Field, { Textarea } from "@/components/ui/Field";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeepRoastStore } from "@/lib/store";
import type { Config } from "@/types";
import ChannelManager, {
  createChannelDrafts,
  type ChannelDraft,
} from "@/components/Settings/ChannelManager";
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
  const [channels, setChannels] = useState<ChannelDraft[]>(() =>
    createChannelDrafts(config),
  );
  const [imageSystemPrompt, setImageSystemPrompt] = useState(
    config.imageSystemPrompt || "",
  );
  const [assistantImagePrompt, setAssistantImagePrompt] = useState(
    config.assistantImagePrompt || "",
  );
  const [reversePromptModel, setReversePromptModel] = useState(
    config.reversePromptModel || "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const wasOpen = useRef(false);
  const [baseline, setBaseline] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const epoch = useDeepRoastStore((state) => state.userSessionVersion);
  const requestVersion = useRef(0);
  const snapshot = JSON.stringify({
    channels,
    imageSystemPrompt,
    assistantImagePrompt,
    reversePromptModel,
  });
  const dirty = !!baseline && snapshot !== baseline;
  useEffect(() => {
    requestVersion.current += 1;
    return () => {
      requestVersion.current += 1;
    };
  }, [open, epoch]);
  function requestClose() {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  useEffect(() => {
    if (open && !wasOpen.current) {
      setChannels(createChannelDrafts(config));
      setImageSystemPrompt(config.imageSystemPrompt || "");
      setAssistantImagePrompt(config.assistantImagePrompt || "");
      setReversePromptModel(config.reversePromptModel || "");
      setMessage("");
      setSaving(false);
      setDiscardOpen(false);
      setBaseline(
        JSON.stringify({
          channels: createChannelDrafts(config),
          imageSystemPrompt: config.imageSystemPrompt || "",
          assistantImagePrompt: config.assistantImagePrompt || "",
          reversePromptModel: config.reversePromptModel || "",
        }),
      );
    }
    wasOpen.current = open;
  }, [open, config]);

  async function handleSave() {
    if (saving) return;
    const request = requestVersion.current;
    setSaving(true);
    setMessage("");
    try {
      const channelModels = (kind: "text" | "image") =>
        channels
          .filter((channel) => channel.enabled)
          .flatMap((channel) =>
            channel.models
              .filter((model) => model.kind === kind && model.enabled)
              .map((model) => model.modelId),
          );
      const defaultModel = (kind: "text" | "image", fallback: string) =>
        channels
          .flatMap((channel) => channel.models)
          .find(
            (model) => model.kind === kind && model.enabled && model.isDefault,
          )?.modelId || fallback;

      const payload: Record<string, unknown> = {
        channels: channels.map(
          ({
            id,
            name,
            baseUrl,
            apiKey,
            apiKeyHint,
            enabled,
            sortOrder,
            models,
          }) => ({
            id,
            name,
            baseUrl,
            apiKey,
            apiKeyHint,
            enabled,
            sortOrder,
            models,
          }),
        ),
        // 保留旧字段，兼容尚未切换到渠道读取的客户端与回滚场景。
        textModel: defaultModel("text", config.textModel),
        imageModel: defaultModel("image", config.imageModel),
        imageSystemPrompt,
        assistantImagePrompt,
        // 允许留空：运行时回落默认视觉模型
        reversePromptModel: reversePromptModel.trim(),
        enabledTextModels: channelModels("text"),
        enabledImageModels: channelModels("image"),
      };
      await onSave(payload);
      if (requestVersion.current !== request) return;
      const savedChannels = channels.map((channel) => ({
        ...channel,
        apiKey: "",
      }));
      setChannels(savedChannels);
      setBaseline(
        JSON.stringify({
          channels: savedChannels,
          imageSystemPrompt,
          assistantImagePrompt,
          reversePromptModel,
        }),
      );
      setMessage("✓ 保存成功");
    } catch (err: unknown) {
      if (requestVersion.current !== request) return;
      const msg =
        err instanceof Error && err.message ? err.message : "保存失败";
      setMessage(`✗ ${msg}`);
    }
    if (requestVersion.current === request) setSaving(false);
  }

  if (!open) return null;

  const primaryChannel =
    channels.find((channel) => channel.enabled) || channels[0];
  const reverseBaseUrl = primaryChannel?.baseUrl || config.baseUrl;
  const reverseApiKey = primaryChannel?.apiKey || "";
  const reverseHasSavedKey = Boolean(
    primaryChannel?.apiKeyHint || config.hasApiKey,
  );

  return (
    <>
      <Dialog open={open} onClose={requestClose} label="管理员配置">
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={requestClose}
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
              <Button
                size="icon"
                aria-label="关闭设置"
                disabled={saving}
                onClick={requestClose}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </Button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <fieldset
                disabled={saving}
                className="space-y-4 border-0 m-0 p-0 min-w-0"
              >
                <p className="ui-field-hint">
                  {dirty ? "有未保存的修改" : "修改后点击保存生效"}
                </p>
                <ChannelManager value={channels} onChange={setChannels} />

                <ReversePromptModelPicker
                  value={reversePromptModel}
                  onChange={setReversePromptModel}
                  baseUrl={reverseBaseUrl}
                  savedBaseUrl={config.baseUrl}
                  apiKey={reverseApiKey}
                  hasSavedApiKey={reverseHasSavedKey}
                />

                <Field
                  label="图片生成系统提示词"
                  hint="将在每次生图时自动附加到用户输入的提示词前面"
                >
                  {(field) => (
                    <Textarea
                      {...field}
                      disabled={saving}
                      value={imageSystemPrompt}
                      onChange={(e) => setImageSystemPrompt(e.target.value)}
                      placeholder="例如：高质量、8K分辨率、构图精美、光影自然"
                      rows={3}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm resize-none transition-colors duration-200"
                    />
                  )}
                </Field>

                <Field
                  label="助手形象提示词"
                  hint="用户在对话中说“我想看看你”时，会用这段提示词生成固定助手形象"
                >
                  {(field) => (
                    <Textarea
                      {...field}
                      disabled={saving}
                      value={assistantImagePrompt}
                      onChange={(e) => setAssistantImagePrompt(e.target.value)}
                      placeholder="例如：虚构的成年 AI 助手，短发，温和微笑，现代简洁穿搭，自然光"
                      rows={3}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm resize-none transition-colors duration-200"
                    />
                  )}
                </Field>

                {message && (
                  <p
                    role={message.includes("✓") ? "status" : "alert"}
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
              </fieldset>
            </div>

            <div
              className="px-5 py-3 border-t flex justify-end gap-3 shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <Button onClick={requestClose} disabled={saving}>
                取消
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={open && discardOpen}
        title="放弃未保存的修改？"
        message="关闭后这次修改不会保存。你也可以继续编辑。"
        confirmText="放弃修改"
        cancelText="继续编辑"
        onConfirm={onClose}
        onClose={() => setDiscardOpen(false)}
      />
    </>
  );
}
