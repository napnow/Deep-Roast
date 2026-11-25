import type { Metadata } from "next";
import "./fonts.css";
import "@xyflow/react/dist/style.css";
import { ToastProvider } from "@/components/Toast";
import AuthProvider from "@/components/AuthProvider";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import "./globals.css";
import "./studio-preview.css";
import "./ui-polish.css";
import "./redesign.css";
import "./redesign-shell.css";
import "./unify.css";

export const metadata: Metadata = {
  title: "深焙 Deep Roast",
  description: "深焙 — 慢工细作，让灵感显影为好作品",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png?v=puppy", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png?v=puppy", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png?v=puppy", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon-64.png?v=puppy",
    apple: "/brand-mark.png?v=puppy",
  },
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
  viewportFit: "cover",
};

const suppressTransitionWarning = `
  (() => {
    const origWarn = console.warn;
    console.warn = (...args) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('Transition was skipped')) return;
      origWarn.apply(console, args);
    };
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason;
      if (reason && typeof reason.message === 'string' && reason.message.includes('Transition')) {
        e.preventDefault();
      }
    });
  })();
`;

const themeScript = `
  (() => {
    const t = localStorage.getItem('theme');
    const isDark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#141210' : '#f8f7f4');
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
      <body className="dr-fonts h-full antialiased">
        <ToastProvider>
          <AuthProvider>
            <ConfirmProvider>
              <div className="dr-app h-full">{children}</div>
            </ConfirmProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
