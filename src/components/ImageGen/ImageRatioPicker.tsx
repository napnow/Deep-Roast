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
    <div className="creation-setting-group">
      <div className="flex items-center gap-2">
        <input className="ui-field min-w-0 w-20" type="number" inputMode="numeric" min={1} max={100} step={1}
          aria-label="自定义比例宽" aria-describedby={id} aria-invalid={!output}
          value={width} disabled={disabled} onChange={(event) => setWidth(event.target.value)} />
        <span aria-hidden="true">:</span>
        <input className="ui-field min-w-0 w-20" type="number" inputMode="numeric" min={1} max={100} step={1}
          aria-label="自定义比例高" aria-describedby={id} aria-invalid={!output}
          value={height} disabled={disabled} onChange={(event) => setHeight(event.target.value)} />
        <button type="button" className="creation-chip" disabled={disabled || !output}
          onClick={() => output && onChange(output)}>应用</button>
      </div>
      <p id={id} className="creation-setting-hint" role="status">
        {output ? `输出 ${output.replace("x", "×")}，点击“应用”使用此比例。` : "请输入 1–100 的整数，宽高比不能超过 6:1 或 1:6。"}
      </p>
      <p className="creation-setting-hint">当前使用：{imageSizeLabel(size)}。画面可能居中裁切，请为主体留出边距。</p>
    </div>
  );
}

export default function ImageRatioPicker({ size, model = "", options, disabled, onChange, presentation = "select" }: Props) {
  const [editing, setEditing] = useState(false);
  const supported = isGptImageModel(model);
  const custom = supported && (editing || !options.some((option) => option.value === size));
  return (
    <div className="creation-setting-group">
      {presentation === "chips" ? (
        <div className="mobile-size-picker" role="group" aria-label="图片比例">
          {options.map((option) => <button key={option.value} type="button"
            aria-pressed={!custom && option.value === size} disabled={disabled}
            className={!custom && option.value === size ? "is-active" : undefined}
            onClick={() => { setEditing(false); onChange(option.value); }}>{option.label}</button>)}
          {supported && <button type="button" aria-pressed={custom} disabled={disabled}
            className={custom ? "is-active" : undefined} onClick={() => setEditing(true)}>自定义比例</button>}
        </div>
      ) : <select className="ui-field creation-select" aria-label="图片比例" disabled={disabled}
        value={custom ? "custom" : size} onChange={(event) => {
          if (event.target.value === "custom") setEditing(true);
          else { setEditing(false); onChange(event.target.value); }
        }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        {supported && <option value="custom">自定义比例</option>}
      </select>}
      {custom && <CustomRatioEditor key={`${model}:${size}`} size={size} disabled={disabled} onChange={onChange} />}
    </div>
  );
}
