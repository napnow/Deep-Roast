"use client";

import { useId, useState } from "react";
import { isGptImageModel, type ImageSizeOption } from "@/lib/image-model-capabilities";
import { greatestCommonDivisor, imageSizeLabel, ratioToImageSize } from "@/lib/custom-image-ratio";

interface Props {
  size: string;
  model?: string;
  options: ImageSizeOption[];
  disabled?: boolean;
  presentation?: "select" | "chips";
  onChange: (size: string) => void;
}

function CustomRatioEditor({ size, disabled, onChange }: Pick<Props, "size" | "disabled" | "onChange">) {
  const match = /^(\d+)x(\d+)$/.exec(size);
  const w = Number(match?.[1] || 1);
  const h = Number(match?.[2] || 1);
  const divisor = greatestCommonDivisor(w, h);
  const [width, setWidth] = useState(String(w / divisor));
  const [height, setHeight] = useState(String(h / divisor));
  const id = useId();
  const output = ratioToImageSize(width, height);
  return (
    <div className="creation-setting-group custom-ratio-editor">
      <span className="custom-ratio-editor__heading">设定你的画幅</span>
      <div className="custom-ratio-editor__inputs">
        <input className="ui-field custom-ratio-editor__input" type="number" inputMode="numeric" min={1} max={100} step={1}
          aria-label="自定义比例宽" aria-describedby={id} aria-invalid={!output}
          value={width} disabled={disabled} onChange={(event) => setWidth(event.target.value)} />
        <span className="custom-ratio-editor__separator" aria-hidden="true">:</span>
        <input className="ui-field custom-ratio-editor__input" type="number" inputMode="numeric" min={1} max={100} step={1}
          aria-label="自定义比例高" aria-describedby={id} aria-invalid={!output}
          value={height} disabled={disabled} onChange={(event) => setHeight(event.target.value)} />
        <button type="button" className="creation-chip custom-ratio-editor__apply" disabled={disabled || !output}
          onClick={() => output && onChange(output)}>应用</button>
      </div>
      <p id={id} className="creation-setting-hint" role="status">
        {output ? `预计尺寸 ${output.replace("x", "×")}` : "请输入 1–100 的整数，宽高比不能超过 6:1 或 1:6。"}
      </p>
      <p className="creation-setting-hint">已选 {imageSizeLabel(size)} · 画面可能裁切，建议主体留白。</p>
    </div>
  );
}

export default function ImageRatioPicker({ size, model = "", options, disabled, onChange, presentation = "select" }: Props) {
  const [editing, setEditing] = useState(false);
  const supported = isGptImageModel(model);
  const custom = supported && (editing || !options.some((option) => option.value === size));
  return (
    <div className="creation-setting-group image-ratio-picker" data-custom={custom ? "true" : "false"}>
      <div className={presentation === "chips" ? "ratio-options mobile-size-picker" : "ratio-options"} role="group" aria-label="图片比例">
        {options.map((option) => {
          const [w, h] = option.value.split("x").map(Number);
          const selected = !custom && option.value === size;
          return <button key={option.value} type="button" className="ratio-option"
            aria-pressed={selected} disabled={disabled} title={option.label}
            onClick={() => { setEditing(false); onChange(option.value); }}>
            <span className="ratio-option__frame" aria-hidden="true"
              style={{ width: 22 * Math.min(1, w / h), height: 22 * Math.min(1, h / w) }} />
            <span>{option.label.split(" ")[0]}</span>
          </button>;
        })}
        {supported && <button type="button" className="ratio-option ratio-option--custom"
          aria-pressed={custom} disabled={disabled} onClick={() => setEditing(true)}>
          <span aria-hidden="true">＋</span><span>自定义</span>
        </button>}
      </div>
      {custom && <CustomRatioEditor key={`${model}:${size}`} size={size} disabled={disabled} onChange={onChange} />}
    </div>
  );
}
