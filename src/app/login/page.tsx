"use client";

import { useEffect, useState } from "react";
import { login, register } from "@/lib/auth-client";
import { useAuth } from "@/components/AuthProvider";
import AdminContactModal from "@/components/Auth/AdminContactModal";
import type { Announcement } from "@/types";

const STAGE_BULLETS = [
  "文生文 · 深度推理",
  "文生图 · 慢火出图",
  "每日签到 · 自托管友好",
];

export default function LoginPage() {
  const { refresh } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch("/api/public/admin-contact")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.registrationEnabled === "boolean") {
          setRegistrationEnabled(d.registrationEnabled);
          if (!d.registrationEnabled) setTab("login");
        }
      })
      .catch(() => {});
    fetch("/api/public/announcements")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.announcements)) setAnnouncements(d.announcements);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("用户名和密码不能为空");
      return;
    }

    if (tab === "register" && !registrationEnabled) {
      setError("当前未开放注册，请联系管理员");
      return;
    }

    setLoading(true);
    try {
      const result =
        tab === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password);
      if (result.success) {
        // 刷新登录态；AuthProvider 会带过渡跳到首页
        await refresh();
      } else {
        setError(result.error || "操作失败");
      }
    } catch {
      setError("网络错误，请重试");
    }
    setLoading(false);
  }

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border-strong)",
    color: "var(--text-primary)",
  } as const;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* 左 · 品牌舞台：桌面固定深焙深色；窄屏隐藏 */}
      <aside
        className="relative hidden md:flex md:w-[46%] lg:w-[48%] flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, #2a211c 0%, #3d2e24 42%, #4a3428 100%)",
          color: "#f3ebe3",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(820px 400px at 20% 10%, rgba(232, 165, 106, 0.26), transparent 52%), radial-gradient(560px 300px at 90% 92%, rgba(255, 200, 140, 0.07), transparent 48%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "180px 180px",
            mixBlendMode: "soft-light",
          }}
          aria-hidden
        />

        {/* 主文案垂直居中，底部脚注贴底 */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 lg:px-14 py-12">
          <div className="max-w-md animate-fade-up space-y-8">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-4"
                style={{ color: "rgba(232, 165, 106, 0.9)" }}
              >
                Deep Roast
              </p>
              <h1 className="font-display text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-none">
                深焙
              </h1>
              <div
                className="mt-5 h-px w-12"
                style={{ background: "rgba(232, 165, 106, 0.55)" }}
                aria-hidden
              />
            </div>

            <p
              className="text-[15px] lg:text-base leading-[1.7] max-w-sm"
              style={{ color: "rgba(243, 235, 227, 0.82)" }}
            >
              深度思考，慢焙出好答案。
              <br />
              把对话与出图放进同一炉火候里。
            </p>

            <ul className="space-y-3 pt-1">
              {STAGE_BULLETS.map((line) => (
                <li
                  key={line}
                  className="flex items-baseline gap-3 text-[13px] lg:text-sm"
                  style={{ color: "rgba(243, 235, 227, 0.7)" }}
                >
                  <span
                    className="mt-[0.55em] h-px w-4 shrink-0"
                    style={{ background: "rgba(232, 165, 106, 0.7)" }}
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p
          className="relative z-10 px-10 lg:px-14 pb-8 text-[11px] tracking-wide"
          style={{ color: "rgba(243, 235, 227, 0.38)" }}
        >
          自托管 · 积分可控 · 慢即是快
        </p>
      </aside>

      {/* 右 · 凭证区 */}
      <main
        className="flex-1 flex flex-col min-h-screen"
        style={{ background: "var(--bg-root)" }}
      >
        {/* 窄屏顶栏字标 */}
        <div
          className="md:hidden flex items-center gap-2.5 px-5 py-4 border-b"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--bg-surface)",
          }}
        >
          <div
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-semibold"
            style={{
              background:
                "linear-gradient(145deg, var(--accent-soft), var(--accent))",
              color: "var(--accent-on)",
            }}
          >
            焙
          </div>
          <div>
            <p
              className="font-display text-base font-semibold leading-none"
              style={{ color: "var(--text-primary)" }}
            >
              深焙
            </p>
            <p
              className="text-[10px] mt-0.5 tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Deep Roast
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[22rem] animate-fade-up">
            <div className="mb-8 hidden md:block">
              <h2
                className="font-display text-2xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {tab === "login" ? "欢迎回来" : "创建账户"}
              </h2>
              <p
                className="text-sm mt-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {tab === "login"
                  ? "登录后继续你的对话与出图"
                  : "注册即可开始使用深焙"}
              </p>
            </div>

            {registrationEnabled ? (
              <div
                className="flex rounded-lg p-0.5 mb-6"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {(["login", "register"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTab(t);
                      setError(null);
                    }}
                    className="flex-1 py-2 rounded-md text-sm font-semibold transition-all duration-200"
                    style={
                      tab === t
                        ? {
                            background: "var(--bg-elevated)",
                            color: "var(--text-primary)",
                            boxShadow: "var(--shadow-sm)",
                            border: "1px solid var(--border-strong)",
                          }
                        : {
                            color: "var(--text-muted)",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    {t === "login" ? "登录" : "注册"}
                  </button>
                ))}
              </div>
            ) : (
              <p
                className="mb-6 text-center text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                当前仅开放登录（注册已关闭）
              </p>
            )}

            {announcements.length > 0 && (
              <div
                className="mb-5 rounded-lg px-3 py-2.5 space-y-2 max-h-36 overflow-y-auto"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <p
                  className="text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  公告
                </p>
                {announcements.slice(0, 5).map((a) => (
                  <div key={a.id}>
                    <p
                      className="text-xs whitespace-pre-wrap"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {a.body}
                    </p>
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleString("zh-CN")
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div
                className="mb-4 px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: "var(--danger-surface)",
                  color: "var(--danger)",
                  border:
                    "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                }}
              >
                {error}
              </div>
            )}

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
                  style={inputStyle}
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
                  style={inputStyle}
                  placeholder="请输入密码"
                  autoComplete={
                    tab === "login" ? "current-password" : "new-password"
                  }
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-on)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {loading ? "处理中..." : tab === "login" ? "登录" : "注册"}
              </button>
            </form>

            {tab === "login" && (
              <>
                <p
                  className="mt-5 text-center text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  忘记密码？{" "}
                  <button
                    type="button"
                    onClick={() => setContactOpen(true)}
                    className="underline font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    联系管理员
                  </button>
                </p>
                <AdminContactModal
                  open={contactOpen}
                  onClose={() => setContactOpen(false)}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
