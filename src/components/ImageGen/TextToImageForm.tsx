"use client";

import type { TextToImageDraft } from "@/lib/image-workspace";
import { IMAGE_STYLE_PRESETS } from "@/types";
import { getCreationSettingsSummary } from "./creation-workbench-ui";

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
  const selectedStyle = IMAGE_STYLE_PRESETS.find(
    (preset) => preset.prompt === draft.stylePrompt,
  );
  const settingsSummary = getCreationSettingsSummary({
    styleLabel: selectedStyle?.label,
    sizeLabel: sizeOptions.find((option) => option.value === draft.size)?.label,
    batchCount: draft.count,
  });

  return (
    <div className="creation-form">
      <section className="creation-step-card" aria-labelledby="text-prompt-title">
        <div className="creation-step-card__heading">
          <span className="creation-step-card__number" aria-hidden="true">01</span>
          <div>
            <h2 id="text-prompt-title" className="creation-step-card__title">
              画面描述
            </h2>
            <p className="creation-step-card__description">
              先说清主体、场景、光线和你想要的氛围
            </p>
          </div>
        </div>

        <label className="creation-composer creation-step-card__composer">
          <span className="sr-only">画面描述</span>
          <textarea
            className="creation-composer__input ui-field"
            value={draft.prompt}
            disabled={disabled}
            onChange={(event) => onChange({ prompt: event.target.value })}
            placeholder="例如：雨夜霓虹街头，一位撑透明伞的旅人…"
            rows={6}
          />
          <span className="creation-composer__counter">
            {draft.prompt.length} / 2000
          </span>
        </label>

        {!draft.prompt ? (
          <div className="creation-suggestions" aria-label="示例提示词">
            <span className="creation-suggestions__label">从灵感开始</span>
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
      </section>

      <details className="creation-settings creation-step-card">
        <summary>
          <span className="creation-step-card__summary">
            <span className="creation-step-card__number" aria-hidden="true">02</span>
            <span>
              <span className="creation-settings__title">生成设置</span>
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
          <fieldset className="creation-setting-group">
            <legend className="creation-section-label">常用风格</legend>
            <div className="creation-chip-list">
              {IMAGE_STYLE_PRESETS.map((preset) => {
                const selected = draft.stylePrompt === preset.prompt;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "creation-chip is-selected"
                        : "creation-chip"
                    }
                    onClick={() => onChange({ stylePrompt: preset.prompt })}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="creation-setting-grid">
            <label className="creation-setting-group">
              <span className="creation-section-label">图片比例</span>
              <select
                className="ui-field creation-select"
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

            <label className="creation-setting-group">
              <span className="creation-section-label">生成数量</span>
              <select
                className="ui-field creation-select"
                value={draft.count}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ count: Number(event.target.value) })
                }
              >
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count} 张
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="creation-setting-group creation-model-note">
            <span className="creation-section-label">当前模型</span>
            <span className="creation-model-note__value">
              {model || "未配置"}
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}
