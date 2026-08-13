"use client";

import { useEffect, useRef, useState } from "react";
import {
  EDIT_STYLE_PRESETS,
  friendlyStyleColor,
  toEditStylePreset,
  type EditStylePreset,
} from "@/components/ImageGen/editStyles";
import { useToast } from "@/components/Toast";
import { apiJson } from "@/lib/client-api";
import type { EditStyle } from "@/types";

/**
 * 管理后台「风格测试」：管理员上传参考图 → 选风格 → 生成预览。
 * 风格列表来自数据库（含未发布，仅供管理端测试）；加载失败时回落硬编码预设。
 * 测试通过后在「风格库」卡片中上架，普通用户即可看到。
 */
export default function AdminStyleTestCard() {
  const { toast } = useToast();
  const [styles, setStyles] = useState<EditStylePreset[]>(EDIT_STYLE_PRESETS);
  const [unpublishedKeys, setUnpublishedKeys] = useState<Set<string>>(new Set());
  const [styleId, setStyleId] = useState(EDIT_STYLE_PRESETS[0]?.id || "");
  const [color, setColor] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    imageUrl: string;
    prompt: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ styles: EditStyle[] }>("/api/admin/styles")
      .then((data) => {
        if (cancelled) return;
        const rows = data.styles || [];
        setStyles(rows.map(toEditStylePreset));
        setUnpublishedKeys(
          new Set(rows.filter((s) => !s.published).map((s) => s.styleKey)),
        );
      })
      .catch(() => {
        // 数据库不可用时沿用硬编码预设
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeStyle = styles.find((s) => s.id === styleId);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      setPreview(data);
      setBase64(data);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function compilePrompt(): string {
    const userDesc = desc.trim() || "生成这张图的变体";
    if (!activeStyle) return userDesc;
    let prefix = activeStyle.prefix;
    if (activeStyle.colors?.length) {
      const c = color || activeStyle.colors[0]!;
      prefix = prefix.replace("{color}", c);
    }
    if (activeStyle.textures?.length) {
      prefix = prefix.replace(
        "{texture}",
        activeStyle.textures[0]!,
      );
    }
    return `${prefix}\n\n用户的修改要求：${userDesc}`;
  }

  async function handleGenerate() {
    if (!base64 || generating) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/image-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          prompt: compilePrompt(),
          size: "1024x1024",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "生成失败", "error");
      } else {
        setResult({ imageUrl: data.imageUrl, prompt: data.prompt });
        toast("生成成功", "success");
      }
    } catch {
      toast("网络错误", "error");
    }
    setGenerating(false);
  }

  return (
    <div className="admin-card">
      <div className="admin-card-body">
        <p className="admin-kicker">Style Lab</p>
        <h2 className="admin-title text-base mt-1">风格测试</h2>
        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
          上传参考图并选择风格，验证效果后到「风格库」卡片上架即可开放给普通用户。
        </p>

        <div className="mt-4 space-y-4">
          {/* 风格选择 */}
          <div>
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              风格
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {styles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95"
                  style={{
                    background:
                      styleId === s.id
                        ? "var(--accent-surface)"
                        : "var(--bg-root)",
                    border: `1px solid ${
                      styleId === s.id ? "var(--accent)" : "var(--border)"
                    }`,
                    color:
                      styleId === s.id
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                  }}
                >
                  {s.label}
                  {unpublishedKeys.has(s.id) && (
                    <span className="ml-1 text-[9px]" style={{ color: "#f97316" }}>
                      未发布
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 主色（仅含 colors 的风格） */}
          {activeStyle?.colors && (
            <div>
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                主色
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {activeStyle.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 active:scale-95"
                    style={{
                      background:
                        color === c || (!color && c === activeStyle.colors?.[0])
                          ? "var(--accent-surface)"
                          : "var(--bg-root)",
                      border: `1px solid ${
                        color === c || (!color && c === activeStyle.colors?.[0])
                          ? "var(--accent)"
                          : "var(--border)"
                      }`,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {friendlyStyleColor(c)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 参考图 */}
          <div>
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              参考图
            </span>
            <div className="mt-1.5 flex items-center gap-2.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={generating}
                className="admin-btn admin-btn--ghost"
              >
                {preview ? "更换参考图" : "选择参考图"}
              </button>
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="参考图"
                  className="w-16 h-16 rounded-lg object-cover border"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
            </div>
          </div>

          {/* 描述 */}
          <div>
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              修改描述（可选）
            </span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="例如：突出产品质感，背景改为渐变深色…"
              rows={2}
              className="mt-1.5 w-full rounded-xl px-3 py-2 text-xs resize-none"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!base64 || generating}
            className="admin-btn admin-btn--accent w-full justify-center"
          >
            {generating ? "生成中…" : "生成测试图"}
          </button>

          {/* 结果 */}
          {result && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="测试结果"
                className="w-full rounded-xl border"
                style={{ borderColor: "var(--border)" }}
              />
              <p
                className="text-[10px] leading-relaxed max-h-24 overflow-y-auto"
                style={{ color: "var(--text-muted)" }}
              >
                实际 Prompt：{result.prompt}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
