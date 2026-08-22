import { apiKeyRecoveryLabel, maskApiKey } from "@/lib/api-key-ui";

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string | null;
  recoverable: boolean;
}

interface ApiKeyRowProps {
  item: ApiKeyItem;
  secret?: string;
  visible: boolean;
  busy: boolean;
  copied: boolean;
  onReveal: () => void;
  onHide: () => void;
  onCopy: () => void;
  onRotate: () => void;
  onDelete: () => void;
}

function formatLastUsed(value: string | null) {
  if (!value) return "尚未使用";
  return `最近使用 ${new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function ApiKeyRow({
  item,
  secret,
  visible,
  busy,
  copied,
  onReveal,
  onHide,
  onCopy,
  onRotate,
  onDelete,
}: ApiKeyRowProps) {
  const displayedKey = visible && secret ? secret : maskApiKey(item.keyPrefix);

  return (
    <article
      className="rounded-2xl border px-4 py-3.5 transition-colors"
      style={{ background: "var(--bg-root)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {item.name || "未命名 Key"}
            </h4>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{
                color: item.status === "active" ? "var(--accent)" : "var(--text-muted)",
                borderColor: item.status === "active" ? "var(--accent)" : "var(--border)",
                background: item.status === "active" ? "var(--accent-surface)" : "var(--bg-surface)",
              }}
            >
              {item.status === "active" ? "使用中" : "已停用"}
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {formatLastUsed(item.lastUsedAt)} · {apiKeyRecoveryLabel(item.recoverable)}
          </p>
        </div>
      </div>

      <div
        className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <code
          className="min-w-0 flex-1 truncate text-[11px] sm:text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {displayedKey}
        </code>
        {item.recoverable ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={visible ? onHide : onReveal}
              className="shrink-0 text-[11px] font-medium disabled:opacity-40"
              style={{ color: "var(--text-muted)" }}
            >
              {visible ? "隐藏" : "显示"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCopy}
              className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
              style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-surface)" }}
            >
              {copied ? "已复制" : "复制"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onRotate}
            className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
            style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-surface)" }}
          >
            {busy ? "生成中…" : "重新生成"}
          </button>
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="text-[10px] disabled:opacity-40"
          style={{ color: "var(--danger)" }}
        >
          删除 Key
        </button>
      </div>
    </article>
  );
}
