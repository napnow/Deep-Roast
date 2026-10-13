import type { Metadata } from "next";
import "./fonts.css";
import { ToastProvider } from "@/components/Toast";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "深焙",
  description: "深焙 — 深度思考，慢工出好答案",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "深焙",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#e6e2d9",
  viewportFit: "cover",
};

const suppressTransitionWarning = `
  (() => {
    const origWarn = console.warn;
    const origError = console.error;

    console.warn = (...args) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('Transition was skipped')) return;
      origWarn.apply(console, args);
    };

    // 也吞掉 ViewTransition 被 abort 产生的 Runtime AbortError（这是正常现象）
    console.error = (...args) => {
      const first = args[0];
      if (first instanceof Error) {
        if (first.name === 'AbortError' || first.message?.includes('Transition')) return;
      }
      if (typeof first === 'string') {
        if (first.includes('AbortError') || first.includes('Transition was skipped')) return;
      }
      origError.apply(console, args);
    };

    // 全局捕获未处理的 transition abort promise rejection
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason;
      if (reason && (reason.name === 'AbortError' || reason.message?.includes('Transition'))) {
        e.preventDefault();
      }
    });
  })();
`;
const themeScript = `
  (() => {
    const t = localStorage.getItem('theme');
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (t === 'light') {
      /* 明确选了浅色，不加 dark */
    } else if (matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
    /* 无偏好时默认浅色，避免主页过黑 */
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/3c7c6164b2587822-s.p.16u3vygyjnhr0.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/03bda585a99c6450-s.p.32sris142tqlb.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/a343f882a40d2cc9-s.p.1sj6eobyi31rd.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: suppressTransitionWarning }} />
      </head>
      <body
        className="dr-fonts h-full antialiased"
      >
        <ToastProvider>
          <AuthProvider>
            <div className="dr-app h-full">{children}</div>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
