"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";
import { buildApiCurlExample, extractPlainApiKey } from "@/lib/api-key-ui";
import ApiKeyRow, { type ApiKeyItem } from "./ApiKeys/ApiKeyRow";
import ApiQuickStart from "./ApiKeys/ApiQuickStart";

interface ApiKeysModalProps {
  open: boolean;
  onClose: () => void;
}

function extractRecord(value: unknown): ApiKeyItem | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const payload = root.data && typeof root.data === "object"
    ? root.data as Record<string, unknown>
    : root;
  return payload.record && typeof payload.record === "object"
    ? payload.record as ApiKeyItem
    : null;
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("复制失败");
}

export default function ApiKeysModal({ open, onClose }: ApiKeysModalProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [exampleCopied, setExampleCopied] = useState(false);
  const [origin, setOrigin] = useState("https://<你的域名>");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const sessionRef = useRef(0);

  const curlCommand = useMemo(() => buildApiCurlExample(origin), [origin]);

  async function load(session: number) {
    setLoading(true);
    try {
      const data = await apiJson<{ keys: ApiKeyItem[] }>("/api/user/api-keys");
      if (sessionRef.current !== session) return;
      setKeys(data.keys || []);
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Key 列表加载失败");
    } finally {
      if (sessionRef.current === session) setLoading(false);
    }
  }

  useEffect(() => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    setSecrets({});
    setVisibleIds(new Set());
    setCopiedKeyId(null);
    setCreating(false);
    setBusyKeyId(null);
    setLoading(false);
    if (!open) {
      return;
    }
    setMessage("");
    setMessageTone("success");
    setExampleCopied(false);
    setOrigin(window.location.origin);
    void load(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function closeModal() {
    sessionRef.current += 1;
    setSecrets({});
    setVisibleIds(new Set());
    setCopiedKeyId(null);
    setCreating(false);
    setBusyKeyId(null);
    onClose();
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = sessionRef.current;
    setCreating(true);
    setMessage("");
    try {
      const data = await apiJson<unknown>("/api/user/api-keys", {
        method: "POST",
        ...jsonBody({ name }),
      });
      const plainKey = extractPlainApiKey(data);
      const record = extractRecord(data);
      if (!plainKey || !record) throw new Error("Key 创建成功，但返回内容不完整");
      if (sessionRef.current !== session) return;

      setKeys((current) => [...current, record]);
      setSecrets((current) => ({ ...current, [record.id]: plainKey }));
      setVisibleIds((current) => new Set(current).add(record.id));
      setName("");
      setMessageTone("success");
      setMessage("Key 已创建并加密保存，以后仍可在这里复制。");
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      if (sessionRef.current === session) setCreating(false);
    }
  }

  async function getSecret(item: ApiKeyItem, session: number) {
    if (secrets[item.id]) return secrets[item.id];
    const data = await apiJson<unknown>(`/api/user/api-keys/${item.id}/secret`);
    if (sessionRef.current !== session) return null;
    const plainKey = extractPlainApiKey(data);
    if (!plainKey) throw new Error("没有读取到完整 Key");
    setSecrets((current) => ({ ...current, [item.id]: plainKey }));
    return plainKey;
  }

  async function reveal(item: ApiKeyItem) {
    const session = sessionRef.current;
    setBusyKeyId(item.id);
    setMessage("");
    try {
      const plainKey = await getSecret(item, session);
      if (!plainKey || sessionRef.current !== session) return;
      setVisibleIds((current) => new Set(current).add(item.id));
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "读取失败");
    } finally {
      if (sessionRef.current === session) setBusyKeyId(null);
    }
  }

  async function copyKey(item: ApiKeyItem) {
    const session = sessionRef.current;
    setBusyKeyId(item.id);
    setMessage("");
    try {
      const plainKey = await getSecret(item, session);
      if (!plainKey || sessionRef.current !== session) return;
      await writeClipboard(plainKey);
      if (sessionRef.current !== session) return;
      setCopiedKeyId(item.id);
      window.setTimeout(() => setCopiedKeyId((current) => current === item.id ? null : current), 1600);
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "复制失败");
    } finally {
      if (sessionRef.current === session) setBusyKeyId(null);
    }
  }

  async function rotate(item: ApiKeyItem) {
    if (!window.confirm("重新生成后，旧 Key 会立即失效，是否继续？")) return;
    const session = sessionRef.current;
    setBusyKeyId(item.id);
    setMessage("");
    try {
      const data = await apiJson<unknown>(`/api/user/api-keys/${item.id}/rotate`, {
        method: "POST",
      });
      const plainKey = extractPlainApiKey(data);
      const record = extractRecord(data);
      if (!plainKey || !record) throw new Error("重新生成成功，但返回内容不完整");
      if (sessionRef.current !== session) return;

      setKeys((current) => current.map((key) => key.id === item.id ? record : key));
      setSecrets((current) => {
        const next = { ...current };
        delete next[item.id];
        next[record.id] = plainKey;
        return next;
      });
      setVisibleIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        next.add(record.id);
        return next;
      });
      setMessageTone("success");
      setMessage("新 Key 已生成，旧 Key 已失效，请更新第三方工具配置。");
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "重新生成失败");
    } finally {
      if (sessionRef.current === session) setBusyKeyId(null);
    }
  }

  async function revoke(item: ApiKeyItem) {
    if (!window.confirm(`确定删除${item.name ? `“${item.name}”` : "这个 Key"}吗？删除后无法恢复。`)) return;
    const session = sessionRef.current;
    setBusyKeyId(item.id);
    setMessage("");
    try {
      await apiJson(`/api/user/api-keys/${item.id}`, { method: "DELETE" });
      if (sessionRef.current !== session) return;
      setKeys((current) => current.filter((key) => key.id !== item.id));
      setSecrets((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (error: unknown) {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      if (sessionRef.current === session) setBusyKeyId(null);
    }
  }

  async function copyExample() {
    const session = sessionRef.current;
    try {
      await writeClipboard(curlCommand);
      if (sessionRef.current !== session) return;
      setExampleCopied(true);
      window.setTimeout(() => setExampleCopied(false), 1600);
    } catch {
      if (sessionRef.current !== session) return;
      setMessageTone("error");
      setMessage("调用示例复制失败");
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={closeModal} />
      <div className="relative z-10 flex h-full items-center justify-center p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-access-title"
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[36rem] flex-col overflow-hidden rounded-[1.5rem] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "0 28px 80px rgba(34, 24, 17, 0.28)",
          }}
        >
          <header className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-lg"
                style={{ color: "var(--accent)", borderColor: "var(--border-strong)", background: "var(--accent-surface)" }}
                aria-hidden="true"
              >
                ◆
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  DEVELOPER ACCESS
                </p>
                <h2 id="api-access-title" className="mt-0.5 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  API 接入
                </h2>
                <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
                  在第三方工具调用本站生图模型，每张图消耗 5 积分
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label="关闭 API 接入"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg transition-transform hover:scale-105"
              style={{ color: "var(--text-muted)" }}
            >
              ×
            </button>
          </header>

          <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <form
              onSubmit={createKey}
              className="rounded-2xl border p-4"
              style={{ borderColor: "var(--border-strong)", background: "var(--accent-surface)" }}
            >
              <div className="mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  创建新 Key
                </h3>
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  创建后会加密保存，可随时回来复制
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                  <span className="mb-1.5 block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Key 备注</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    placeholder="备注名称，例如：手机端工具"
                    className="h-11 w-full rounded-xl border px-3.5 text-xs outline-none transition-colors focus:border-[var(--accent)]"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={creating}
                  className="h-11 shrink-0 rounded-xl px-5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  style={{ background: "var(--accent)" }}
                >
                  {creating ? "正在创建…" : "创建 Key"}
                </button>
              </div>
            </form>

            {message && (
              <div
                role="status"
                className="rounded-xl border px-3.5 py-2.5 text-[11px] leading-5"
                style={{
                  color: messageTone === "error" ? "var(--danger)" : "var(--accent)",
                  borderColor: messageTone === "error" ? "var(--danger)" : "var(--border-strong)",
                  background: messageTone === "error" ? "var(--danger-surface)" : "var(--accent-surface)",
                }}
              >
                {message}
              </div>
            )}

            <section>
              <div className="mb-2.5 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    我的 Keys
                  </h3>
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {keys.length} / 10 个 · 完整 Key 默认隐藏
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border px-4 py-8 text-center text-xs" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                  正在读取…
                </div>
              ) : keys.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-8 text-center" style={{ borderColor: "var(--border-strong)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>还没有 API Key</p>
                  <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>在上方填写备注并创建第一个 Key</p>
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                  {keys.map((item) => (
                    <ApiKeyRow
                      key={item.id}
                      item={item}
                      secret={secrets[item.id]}
                      visible={visibleIds.has(item.id)}
                      busy={busyKeyId === item.id}
                      copied={copiedKeyId === item.id}
                      onReveal={() => void reveal(item)}
                      onHide={() => setVisibleIds((current) => {
                        const next = new Set(current);
                        next.delete(item.id);
                        return next;
                      })}
                      onCopy={() => void copyKey(item)}
                      onRotate={() => void rotate(item)}
                      onDelete={() => void revoke(item)}
                    />
                  ))}
                </div>
              )}
            </section>

            <ApiQuickStart command={curlCommand} copied={exampleCopied} onCopy={() => void copyExample()} />
          </div>
        </section>
      </div>
    </div>
  );
}
