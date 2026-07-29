"use client";

import { useState } from "react";
import { login, register } from "@/lib/auth-client";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 已登录跳转由 AuthProvider 统一处理，这里直接渲染表单，避免 checking 卡死导致白屏

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("用户名和密码不能为空");
      return;
    }

    setLoading(true);
    try {
      const result =
        tab === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password);
      if (result.success) {
        // 硬导航确保 cookie 被浏览器完全吸收
        window.location.href = "/";
      } else {
        setError(result.error || "操作失败");
      }
    } catch {
      setError("网络错误，请重试");
    }
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-root)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <p className="text-4xl mb-2 select-none">☕</p>
          <h1
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            深焙
          </h1>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            深度思考，慢焙出好答案
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-lg p-0.5 mb-6"
          style={{ background: "var(--bg-root)" }}
        >
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                tab === t ? "shadow-sm" : ""
              }`}
              style={
                tab === t
                  ? {
                      background: "var(--bg-surface)",
                      color: "var(--accent)",
                      boxShadow: "var(--shadow-sm)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              {t === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-lg text-xs font-medium"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              color: "var(--danger, #ef4444)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="请输入密码"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            {loading ? "处理中..." : tab === "login" ? "登录" : "注册"}
          </button>
        </form>
        {tab === "login" && (
          <p
            className="mt-4 text-center text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            忘记密码？请联系管理员重置
          </p>
        )}
      </div>
    </div>
  );
}
