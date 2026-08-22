interface ApiQuickStartProps {
  command: string;
  copied: boolean;
  onCopy: () => void;
}

export default function ApiQuickStart({ command, copied, onCopy }: ApiQuickStartProps) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{ background: "var(--bg-root)", borderColor: "var(--border)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            快速调用
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            把示例中的 Key 和模型名替换为你的配置
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold"
          style={{ color: "var(--accent)", borderColor: "var(--border-strong)", background: "var(--bg-surface)" }}
        >
          {copied ? "已复制" : "复制示例"}
        </button>
      </div>
      <pre
        className="whitespace-pre-wrap break-words rounded-xl border p-3 text-[10px] leading-5"
        style={{ color: "var(--text-secondary)", background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {command}
      </pre>
      <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
        可用模型：<code>GET /api/v1/models</code> · 每张图扣 5 积分
      </p>
    </section>
  );
}
