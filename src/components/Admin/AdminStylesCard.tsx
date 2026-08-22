"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";
import type { EditStyle } from "@/types";

const EMPTY_FORM = {
  styleKey: "",
  label: "",
  prefix: "",
  colors: "",
  textures: "",
};

export default function AdminStylesCard() {
  const [list, setList] = useState<EditStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ styles: EditStyle[] }>("/api/admin/styles");
      setList(data.styles || []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "加载失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function parseList(s: string): string[] {
    return s
      .split(/[,，]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function save() {
    if (
      !form.label.trim() ||
      !form.styleKey.trim() ||
      !form.prefix.trim() ||
      saving
    ) {
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        styleKey: form.styleKey.trim(),
        label: form.label.trim(),
        prefix: form.prefix.trim(),
        colors: parseList(form.colors),
        textures: parseList(form.textures),
      };
      if (editingId) {
        await apiJson(`/api/admin/styles/${editingId}`, {
          method: "PATCH",
          ...jsonBody(payload),
        });
        setMsg("已保存");
      } else {
        await apiJson("/api/admin/styles", {
          method: "POST",
          ...jsonBody(payload),
        });
        setMsg("已新增（未发布，测试通过后上架）");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  }

  function startEdit(s: EditStyle) {
    setEditingId(s.id);
    setForm({
      styleKey: s.styleKey,
      label: s.label,
      prefix: s.prefix,
      colors: s.colors.join(", "),
      textures: s.textures.join(", "),
    });
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg("");
  }

  async function togglePublished(s: EditStyle) {
    if (saving) return;
    setSaving(true);
    setMsg("");
    try {
      await apiJson(`/api/admin/styles/${s.id}`, {
        method: "PATCH",
        ...jsonBody({ published: !s.published }),
      });
      setMsg(s.published ? "已下架（普通用户不可见）" : "已上架（普通用户可见）");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "操作失败");
    }
    setSaving(false);
  }

  async function remove(s: EditStyle) {
    if (!confirm(`删除风格「${s.label}」？该操作不可恢复。`)) return;
    setSaving(true);
    setMsg("");
    try {
      await apiJson(`/api/admin/styles/${s.id}`, { method: "DELETE" });
      if (editingId === s.id) cancelEdit();
      setMsg("已删除");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "删除失败");
    }
    setSaving(false);
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <p className="admin-kicker">Style Library</p>
          <h2 className="admin-title text-lg mt-1">图生图风格库</h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            新增/编辑风格规则，上架后对普通用户可见；未发布风格仅管理端测试可见
          </p>
        </div>
        <span
          className="text-[11px] tabular-nums px-2 py-0.5 rounded-full"
          style={{
            background: "var(--bg-root)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          {list.length}
        </span>
      </div>

      <div className="admin-card-body space-y-4">
        {/* 新增 / 编辑表单 */}
        <div
          className="rounded-[var(--radius)] p-3 space-y-2.5"
          style={{
            background: "var(--bg-root)",
            border: `1px solid ${editingId ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
              {editingId ? "编辑风格" : "新增风格"}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                取消编辑
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="风格名称，如：新复古编辑海报"
              maxLength={30}
              className="admin-input"
            />
            <input
              value={form.styleKey}
              onChange={(e) =>
                setForm({ ...form, styleKey: e.target.value.toLowerCase() })
              }
              placeholder="风格标识，如：neo-vintage（小写英文）"
              maxLength={40}
              className="admin-input"
            />
          </div>
          <textarea
            value={form.prefix}
            onChange={(e) => setForm({ ...form, prefix: e.target.value })}
            placeholder="风格规则文本（会拼接在用户描述前），支持 {color} / {texture} 槽位；建议在末尾列出「避免：…」"
            rows={5}
            maxLength={8000}
            className="admin-input resize-y"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              value={form.colors}
              onChange={(e) => setForm({ ...form, colors: e.target.value })}
              placeholder="可选主色（逗号分隔），如：deep navy, burnt orange"
              className="admin-input"
            />
            <input
              value={form.textures}
              onChange={(e) => setForm({ ...form, textures: e.target.value })}
              placeholder="可选纹理（逗号分隔），如：heavy paper grain, ink bleed"
              className="admin-input"
            />
          </div>
          <button
            type="button"
            disabled={
              saving || !form.label.trim() || !form.styleKey.trim() || !form.prefix.trim()
            }
            onClick={save}
            className="admin-btn admin-btn--solid"
          >
            {saving ? "处理中…" : editingId ? "保存修改" : "新增风格"}
          </button>
        </div>

        {/* 风格列表 */}
        {loading ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            加载中…
          </p>
        ) : list.length === 0 ? (
          <div
            className="rounded-[var(--radius)] px-3 py-6 text-center text-xs"
            style={{
              background: "var(--bg-root)",
              color: "var(--text-muted)",
              border: "1px dashed var(--border-strong)",
            }}
          >
            暂无风格，先新增一个吧
          </div>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
            {list.map((s) => (
              <li
                key={s.id}
                className="rounded-[var(--radius)] px-3 py-2.5"
                style={{
                  background: "var(--bg-root)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex justify-between gap-3 items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>
                        {s.label}
                      </p>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: s.published
                            ? "rgba(16,185,129,0.12)"
                            : "rgba(249,115,22,0.12)",
                          color: s.published ? "#10b981" : "#f97316",
                          border: `1px solid ${s.published ? "#10b981" : "#f97316"}`,
                        }}
                      >
                        {s.published ? "已上架" : "未发布"}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {s.styleKey} · {s.colors.length} 色 · {s.textures.length} 纹理
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => togglePublished(s)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md"
                      style={{
                        color: s.published ? "var(--text-muted)" : "#10b981",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {s.published ? "下架" : "上架"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => startEdit(s)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md"
                      style={{ color: "var(--accent)", border: "1px solid var(--border)" }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => remove(s)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md"
                      style={{ color: "var(--danger)", border: "1px solid var(--border)" }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {msg && (
          <p
            className="text-[11px] font-medium"
            style={{
              color: /失败|错误/.test(msg) ? "var(--danger)" : "var(--success)",
            }}
          >
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}
