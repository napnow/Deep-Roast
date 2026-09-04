"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { login, register } from "@/lib/auth-client";
import { normalizeInviteCode } from "@/lib/invitation";
import { useAuth } from "@/components/AuthProvider";
import AdminContactModal from "@/components/Auth/AdminContactModal";
import LoginIntro from "@/components/LoginIntro";
import Magnetic from "@/components/Magnetic";

const TITLE = "Deep Roast";

export default function LoginPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [focusField, setFocusField] = useState<"username" | "password" | null>(null);
  // 开屏初始化完成（以挂载时刻为基准编排标题/口号/按钮入场）
  const [introDone, setIntroDone] = useState(false);
  // 开屏被跳过（reduced-motion / 会话内已播过）→ 内容应立即出现
  const [introSkipped, setIntroSkipped] = useState(false);
  // 是否已点击「开始使用」：直接切换到登录表单视图（不再滚动分屏）
  const [showForm, setShowForm] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return normalizeInviteCode(
      new URLSearchParams(window.location.search).get("invite"),
    );
  });

  const heroRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect：在浏览器绘制前同步加 dark class，避免主题切换闪屏
  useLayoutEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    if (!hadDark) html.classList.add("dark");

    // 只在宽屏（桌面）锁 body 滚动：桌面 .snap-scroll 自带滚动容器，锁 body 不影响它；
    // 移动端（≤640px）页面是两屏纵向拼接，锁 body 会直接把页面钉在第一屏，
    // 导致第二屏的登录/注册表单看不到、点不到 —— 这是"按钮点不动"的元凶之一。
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    const hadNoScroll = document.body.style.overflow;
    if (!isNarrow) document.body.style.overflow = "hidden";

    return () => {
      if (!hadDark) html.classList.remove("dark");
      document.body.style.overflow = hadNoScroll;
    };
  }, []);

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
          : await register(username.trim(), password, inviteCode);
      if (result.success) {
        await refresh();
      } else {
        setError(result.error || "操作失败");
      }
    } catch {
      setError("网络错误，请重试");
    }
    setLoading(false);
  }

  return (
    <>
      {/* auth 状态确认前用同色占位层遮挡，避免登录页闪现后再被开屏盖住 */}
      {authLoading && <div className="login-intro-placeholder" aria-hidden />}
      {/* 已登录用户会被 AuthProvider 重定向到工作台，无需播开屏 */}
      {!user &&
        !authLoading && (
          <LoginIntro
            onReady={() => setIntroDone(true)}
            onSkipped={() => {
              setIntroDone(true);
              setIntroSkipped(true);
            }}
          />
        )}
      <div
        className="snap-scroll relative"
        style={{
          background:
            "linear-gradient(170deg, #201a14 0%, #181310 50%, #120e0b 100%)",
          color: "#ede6dc",
          minHeight: "100vh",
        }}
      >
      {/* 静态光斑背景（无动画，不闪屏）：毛玻璃的「背后光源」，玻璃感的关键 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div
          style={{
            position: "absolute",
            width: "clamp(400px, 60vw, 800px)",
            height: "clamp(400px, 60vw, 800px)",
            background:
              "radial-gradient(circle, rgba(212,137,74,0.10) 0%, rgba(184,106,53,0.05) 35%, transparent 70%)",
            filter: "blur(60px)",
            top: "8%",
            left: "12%",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "clamp(350px, 50vw, 700px)",
            height: "clamp(350px, 50vw, 700px)",
            background:
              "radial-gradient(circle, rgba(184,106,53,0.08) 0%, rgba(138,78,35,0.04) 40%, transparent 75%)",
            filter: "blur(70px)",
            bottom: "2%",
            right: "8%",
          }}
        />
      </div>

      {/* 屏 1 · 品牌首屏（字母自动点燃）；点击「开始使用」后隐藏，直接切到表单 */}
      {!showForm && (
        <section
          id="hero"
          ref={heroRef}
          className="snap-section flex items-center justify-center px-8"
        >
          <div className="relative text-center max-w-5xl">
            {/* 大标题：字母自动从左到右点燃（玻璃渐变文字） */}
            <h1
              className="font-display italic font-normal tracking-[-0.02em] inline-flex items-baseline"
              style={{
                fontSize: "clamp(2.5rem, 11vw, 7rem)",
                color: "rgba(237,230,220,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              {(() => {
                let charIndex = 0;
                // 阶段一：全部字母雾气浮现成暗字（公共延迟）
                const blurDelay = introDone
                  ? introSkipped
                    ? 0.05
                    : 2.6
                  : 60;
                // 阶段二：从左到右依序点燃（逐字递增，间隔拉大让波次清晰）
                const igniteDelayOf = (i: number) =>
                  introDone
                    ? introSkipped
                      ? 0.4 + i * 0.12
                      : 3.3 + i * 0.13
                    : 60;
                return TITLE.split(" ").map((word, wi) => (
                  <span
                    key={wi}
                    className="inline-block"
                    style={{ marginRight: "0.28em" }}
                  >
                    {word.split("").map((ch) => {
                      const idx = charIndex++;
                      return (
                        <span
                          key={idx}
                          className="hero-char"
                          style={
                            {
                              "--blur-delay": `${blurDelay}s`,
                              "--char-delay": `${igniteDelayOf(idx)}s`,
                            } as React.CSSProperties
                          }
                        >
                          {ch}
                        </span>
                      );
                    })}
                  </span>
                ));
              })()}
            </h1>

            {/* slogan 遮罩揭示 */}
            <div className="overflow-hidden mt-3">
              <p
                className="hero-rise text-base sm:text-lg md:text-xl leading-relaxed"
                style={{
                  color: "#a89a8a",
                  animation:
                    "hero-rise 1.5s cubic-bezier(0.16,1,0.3,1) " +
                    (introDone ? (introSkipped ? 0.6 : 5.0) : 60) +
                    "s both",
                }}
              >
                深度思考，慢工出好答案。
              </p>
            </div>

            <Magnetic className="mt-10 sm:mt-14">
              <a
                href="#start"
                onClick={(e) => {
                  e.preventDefault();
                  setShowForm(true);
                }}
                className="hero-fade hero-cta"
                style={{
                  animation:
                    "hero-fade 1.1s ease " +
                    (introDone ? (introSkipped ? 0.8 : 5.4) : 60) +
                    "s both",
                }}
              >
                <span>开始使用</span>
                <span className="hero-cta-arrow" aria-hidden>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </a>
            </Magnetic>
          </div>
        </section>
      )}

      {/* 屏 2 · 登录/注册（点击「开始使用」后直接显示，无滚动切换） */}
      {showForm && (
        <section
          id="start"
          className="snap-section relative flex items-center justify-center px-4 sm:px-6 pt-8 pb-12 sm:pt-0 sm:pb-0"
        >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 420px at 50% 42%, rgba(212,137,74,0.06), transparent 55%)",
          }}
          aria-hidden
        />

        <div
          className="relative w-full max-w-[22rem] sm:max-w-[24rem] animate-fade-rise-delay-2 login-card-glass rounded-[1.5rem] sm:rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10 md:px-10 md:py-11"
        >
          {/* 顶部焦糖细线 */}
          <div
            className="absolute top-0 left-1/2 h-px w-12 -translate-x-1/2"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(212,137,74,0.8), transparent)",
            }}
            aria-hidden
          />

          {/* 标题（key=tab 让切换时重新淡入） */}
          <div key={tab} className="mb-7 text-center sm:mb-8 animate-fade-in">
            <h2
              className="font-display text-[1.35rem] sm:text-[1.5rem] font-semibold tracking-tight"
              style={{ color: "#ede6dc" }}
            >
              {tab === "login" ? "欢迎回来" : "创建账户"}
            </h2>
            <p className="mt-1.5 text-[13px]" style={{ color: "#a89a8a" }}>
              {tab === "login"
                ? "登录后继续你的对话与出图"
                : "注册即可开始使用"}
            </p>
          </div>

          {/* Tab 切换：简约下划线式 */}
          {registrationEnabled ? (
            <div className="mb-7 flex items-center justify-center gap-4 sm:gap-8">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  className="relative pb-1.5 px-4 py-1.5 text-[14px] sm:text-sm transition-colors duration-200 active:scale-[0.98]"
                  style={{
                    color: tab === t ? "#ede6dc" : "#8a827a",
                    fontWeight: tab === t ? 600 : 400,
                    minWidth: "4rem",
                  }}
                >
                  {t === "login" ? "登录" : "注册"}
                  <span
                    className="absolute bottom-0 left-1/2 h-px -translate-x-1/2 transition-all duration-300"
                    style={{
                      width: tab === t ? "100%" : "0%",
                      background:
                        "linear-gradient(90deg, transparent, #d4894a, transparent)",
                    }}
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-8 text-center text-xs" style={{ color: "#8a827a" }}>
              当前仅开放登录（注册已关闭）
            </p>
          )}

          {tab === "register" && inviteCode && (
            <div
              className="mb-6 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[11px]"
              style={{
                background: "rgba(212,137,74,0.08)",
                border: "1px solid rgba(212,137,74,0.22)",
                color: "#c9b09a",
              }}
            >
              <span className="min-w-0 truncate">
                已识别邀请链接，注册成功后邀请人将获得奖励
              </span>
              <button
                type="button"
                onClick={() => setInviteCode(null)}
                className="shrink-0 underline underline-offset-2 hover:opacity-80"
                style={{ color: "#d4894a" }}
              >
                清除
              </button>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div
              className="mb-5 rounded-xl px-4 py-2.5 text-xs font-medium"
              style={{
                background: "rgba(201,68,60,0.10)",
                color: "#e8827b",
                border: "1px solid rgba(201,68,60,0.22)",
              }}
            >
              {error}
            </div>
          )}

          {/* 表单：下划线式输入框 */}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-[11px] tracking-[0.15em]"
                style={{ color: "#8a827a" }}
              >
                用户名
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusField("username")}
                  onBlur={() => setFocusField(null)}
                  className="w-full bg-transparent pt-0.5 pb-2.5 text-base sm:text-sm outline-none placeholder:text-[#6b635c]"
                  style={{ color: "#ede6dc" }}
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
                <span
                  className="absolute bottom-0 left-0 block h-px w-full transition-all duration-300"
                  style={{
                    background:
                      focusField === "username"
                        ? "linear-gradient(90deg, #d4894a, #b86a35)"
                        : "rgba(255,255,255,0.14)",
                    boxShadow:
                      focusField === "username"
                        ? "0 1px 8px rgba(212,137,74,0.45)"
                        : "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-[11px] tracking-[0.15em]"
                style={{ color: "#8a827a" }}
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusField("password")}
                  onBlur={() => setFocusField(null)}
                  className="w-full bg-transparent pt-0.5 pb-2.5 pr-9 text-base sm:text-sm outline-none placeholder:text-[#6b635c]"
                  style={{ color: "#ede6dc" }}
                  placeholder="请输入密码"
                  autoComplete={
                    tab === "login" ? "current-password" : "new-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-150 hover:opacity-80 active:scale-90"
                  style={{ color: showPassword ? "#d4894a" : "#8a827a" }}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <span
                  className="absolute bottom-0 left-0 block h-px w-full transition-all duration-300"
                  style={{
                    background:
                      focusField === "password"
                        ? "linear-gradient(90deg, #d4894a, #b86a35)"
                        : "rgba(255,255,255,0.14)",
                    boxShadow:
                      focusField === "password"
                        ? "0 1px 8px rgba(212,137,74,0.45)"
                        : "none",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-3 text-sm font-medium transition-all duration-300 hover:brightness-110 hover:shadow-[0_8px_28px_rgba(212,137,74,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-none disabled:hover:brightness-100"
              style={{
                background: "linear-gradient(135deg, #d4894a 0%, #b86a35 100%)",
                color: "#f5e6d3",
                boxShadow: "0 4px 18px rgba(212,137,74,0.22)",
              }}
            >
              {loading ? "处理中..." : tab === "login" ? "登录" : "注册"}
            </button>
          </form>

          {tab === "login" && (
            <>
              <p className="mt-5 sm:mt-6 text-center text-[11px] sm:text-xs" style={{ color: "#8a827a" }}>
                忘记密码？{" "}
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="font-medium underline-offset-4 transition-colors hover:underline"
                  style={{ color: "#d4894a" }}
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
        </section>
      )}
      </div>
    </>
  );
}
