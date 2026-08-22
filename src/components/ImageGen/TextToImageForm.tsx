"use client";

import type { TextToImageDraft } from "@/lib/image-workspace";
import { IMAGE_STYLE_PRESETS } from "@/types";

interface TextToImageFormProps {
  draft: TextToImageDraft;
  model: string;
  sizeOptions: { value: string; label: string }[];
  disabled: boolean;
  onChange: (next: Partial<TextToImageDraft>) => void;
}

const EXAMPLES = [
  "雨夜霓虹街头，一位撑透明伞的旅人，电影感光影",
  "手工陶杯与深焙咖啡豆，清晨侧光，静物摄影",
  "漂浮在云海上的东方图书馆，宏大而安静",
];

export default function TextToImageForm({
  draft,
  model,
  sizeOptions,
  disabled,
  onChange,
}: TextToImageFormProps) {
  return (
    <div className="creation-form">
      <label className="creation-field">
        <span>画面描述</span>
        <textarea
          className="ui-field min-h-32 w-full resize-y px-3 py-3"
          value={draft.prompt}
          disabled={disabled}
          onChange={(event) => onChange({ prompt: event.target.value })}
          placeholder="描述主体、场景、光线与氛围…"
        />
      </label>

      {!draft.prompt ? (
        <div className="flex flex-wrap gap-1.5" aria-label="示例提示词">
          {EXAMPLES.map((example, index) => (
            <button
              key={example}
              type="button"
              className="creation-example"
              onClick={() => onChange({ prompt: example })}
            >
              灵感 {index + 1}
            </button>
          ))}
        </div>
      ) : null}

      <fieldset className="creation-field">
        <legend>常用风格</legend>
        <div className="flex flex-wrap gap-1.5">
          {IMAGE_STYLE_PRESETS.map((preset) => {
            const selected = draft.stylePrompt === preset.prompt;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                className={`creation-chip ${selected ? "is-selected" : ""}`}
                onClick={() => onChange({ stylePrompt: preset.prompt })}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="creation-field">
          <span>图片比例</span>
          <select
            className="ui-field w-full px-2.5"
            value={draft.size}
            disabled={disabled}
            onChange={(event) => onChange({ size: event.target.value })}
          >
            {sizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="creation-field">
          <span>生成数量</span>
          <select
            className="ui-field w-full px-2.5"
            value={draft.count}
            disabled={disabled}
            onChange={(event) => onChange({ count: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count} 张
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="creation-advanced">
        <summary>高级设置</summary>
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-root)] px-3 py-2 text-xs text-[var(--text-muted)]">
          当前模型：<span className="font-mono">{model || "未配置"}</span>
        </div>
      </details>
    </div>
  );
}
