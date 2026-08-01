"use client";

import { useEffect, useRef, useState } from "react";
import { login, register } from "@/lib/auth-client";
import { useAuth } from "@/components/AuthProvider";
import AdminContactModal from "@/components/Auth/AdminContactModal";
import type { Announcement } from "@/types";

const TITLE = "Deep Roast";

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
  const [focusField, setFocusField] = useState<"username" | "password" | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    fetch("/api/public/announcements")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.announcements)) setAnnouncements(d.announcements);
      })
      .catch(() => {});
  }, []);

  // 聚光逐字点燃
  useEffect(() => {
    const hero = heroRef.current;
    const spot = spotRef.current;
    if (!hero || !spot) return;
    const letters = Array.from(
      hero.querySelectorAll<HTMLSpanElement>("[data-letter]")
    );

    function onMove(e: MouseEvent) {
      const rc = hero!.getBoundingClientRect();
      const x = e.clientX - rc.left;
      const y = e.clientY - rc.top;
      spot!.style.left = x + "px";
      spot!.style.top = y + "px";
      for (const sp of letters) {
        const sr = sp.getBoundingClientRect();
        const lx = sr.left + sr.width / 2 - rc.left;
        const ly = sr.top + sr.height / 2 - rc.top;
        const dx = lx - x;
        const dy = ly - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 180) {
          const t = 1 - d / 180;
          sp.style.color =
            t > 0.65
              ? "#f5e6d3"
              : t > 0.35
                ? "#d4894a"
                : "#b86a35";
          sp.style.transform =
            "translateY(" +
            (-t * 5).toFixed(1) +
            "px) scale(" +
            (1 + t * 0.06).toFixed(3) +
            ")";
          sp.style.textShadow = t > 0.5 ? "0 0 20px rgba(212,137,74,0.6)" : "none";
        } else {
          sp.style.color = "rgba(245,230,211,0.35)";
          sp.style.transform = "none";
          sp.style.textShadow = "none";
        }
      }
    }

    hero.addEventListener("mousemove", onMove);
    return () => hero.removeEventListener("mousemove", onMove);
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
    <div
      className="snap-scroll relative"
      style={{
        background: "#0c0b0a",
        color: "#ede6dc",
        minHeight: "100vh",
      }}
    >
      {/* 深层动态光斑背景 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div
          className="glow-drift absolute rounded-full"
          style={{
            width: "clamp(400px, 60vw, 800px)",
            height: "clamp(400px, 60vw, 800px)",
            background: "radial-gradient(circle, rgba(212,137,74,0.12) 0%, rgba(184,106,53,0.06) 35%, transparent 70%)",
            filter: "blur(60px)",
            top: "8%",
            left: "12%",
          }}
        />
        <div
          className="glow-drift-slow absolute rounded-full"
          style={{
            width: "clamp(350px, 50vw, 700px)",
            height: "clamp(350px, 50vw, 700px)",
            background: "radial-gradient(circle, rgba(184,106,53,0.10) 0%, rgba(138,78,35,0.05) 40%, transparent 75%)",
            filter: "blur(70px)",
            bottom: "2%",
            right: "8%",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(500px, 80vw, 1000px)",
            height: "400px",
            background: "radial-gradient(ellipse, rgba(245,230,211,0.06) 0%, transparent 60%)",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </div>

      {/* 噪声纹理层 */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
          mixBlendMode: "overlay",
        }}
        aria-hidden
      />

      {/* 屏 1 · 品牌首屏（聚光逐字点燃） */}
      <section
        id="hero"
        ref={heroRef}
        className="snap-section flex items-center justify-center px-8"
        style={{ cursor: "none" }}
      >
        <div
          className="hero-breathe pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 500px at 50% 45%, rgba(212,137,74,0.08), transparent 65%)",
          }}
          aria-hidden
        />
        <div
          ref={spotRef}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: "clamp(260px, 40vw, 380px)",
            height: "clamp(260px, 40vw, 380px)",
            background:
              "radial-gradient(circle, rgba(245,230,211,0.12), rgba(212,137,74,0.08) 40%, transparent 65%)",
            transform: "translate(-50%,-50%)",
            left: "50%",
            top: "45%",
            transition:
              "left 0.28s cubic-bezier(0.16,1,0.3,1), top 0.28s cubic-bezier(0.16,1,0.3,1)",
          }}
          aria-hidden
        />

        <div className="relative text-center max-w-5xl">
          {/* 大标题：BlurText 逐词模糊浮现 + 逐字点燃 */}
          <h1
            className="font-display italic font-normal tracking-[-0.02em] inline-flex items-baseline"
            style={{
              fontSize: "clamp(2.5rem, 11vw, 7rem)",
              color: "rgba(245,230,211,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            {TITLE.split(" ").map((word, wi) => (
              <span
                key={wi}
                className="blur-word inline-block"
                style={{
                  filter: "blur(10px)",
                  opacity: 0,
                  transform: "translateY(50px)",
                  animation:
                    "blur-in 0.7s cubic-bezier(0.16,1,0.3,1) " +
                    (0.4 + wi * 0.1) +
                    "s forwards",
                  marginRight: "0.28em",
                  flexShrink: 0,
                }}
              >
                {word.split("").map((ch, ci) => (
                  <span
                    key={ci}
                    data-letter
                    className="inline-block"
                    style={{
                      transition: "color 0.5s ease, transform 0.5s ease, text-shadow 0.5s ease",
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          {/* slogan 遮罩揭示 */}
          <div className="overflow-hidden mt-3">
            <p
              className="hero-rise text-base sm:text-lg md:text-xl leading-relaxed"
              style={{
                color: "#a89a8a",
                transform: "translateY(110%)",
                animation:
                  "hero-rise 1.2s cubic-bezier(0.16,1,0.3,1) 1.1s forwards",
              }}
            >
              深度思考，慢工出好答案。
            </p>
          </div>

          <a
            href="#start"
            className="hero-fade inline-block mt-10 sm:mt-14 px-8 py-3 sm:px-10 sm:py-3.5 rounded-full text-xs sm:text-sm font-medium transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #d4894a 0%, #b86a35 100%)",
              color: "#f5e6d3",
              boxShadow: "0 8px 32px rgba(212,137,74,0.25)",
              opacity: 0,
              animation: "hero-fade 1s ease 1.6s forwards",
            }}
          >
            开始使用
          </a>
        </div>
      </section>

      {/* 屏 2 · 登录/注册 */}
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
          className="relative w-full max-w-[22rem] sm:max-w-[24rem] animate-fade-rise-delay-2 rounded-[1.5rem] sm:rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10 md:px-10 md:py-11"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
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

          {/* 公告 */}
          {announcements.length > 0 && (
            <div
              className="mb-6 max-h-24 space-y-2 overflow-y-auto rounded-xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-[10px] font-medium tracking-[0.2em]"
                style={{ color: "#8a827a" }}
              >
                公告
              </p>
              {announcements.slice(0, 3).map((a) => (
                <p
                  key={a.id}
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ color: "#c9c0b4" }}
                >
                  {a.body}
                </p>
              ))}
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusField("password")}
                  onBlur={() => setFocusField(null)}
                  className="w-full bg-transparent pt-0.5 pb-2.5 text-base sm:text-sm outline-none placeholder:text-[#6b635c]"
                  style={{ color: "#ede6dc" }}
                  placeholder="请输入密码"
                  autoComplete={
                    tab === "login" ? "current-password" : "new-password"
                  }
                />
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
    </div>
  );
}