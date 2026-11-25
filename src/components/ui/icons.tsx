import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "menu"
  | "image"
  | "gallery"
  | "chat"
  | "history"
  | "details"
  | "download"
  | "copy"
  | "edit"
  | "search"
  | "more"
  | "wallet"
  | "bell"
  | "announcement"
  | "key"
  | "settings"
  | "sliders"
  | "code"
  | "layout"
  | "heart"
  | "sun"
  | "moon"
  | "logout"
  | "sparkles"
  | "canvas"
  | "user"
  | "refresh"
  | "close"
  | "maximize"
  | "chevron-down"
  | "arrow-left"
  | "trash"
  | "check";

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: AppIconName;
  size?: number;
}

export function AppIcon({ name, size = 16, ...props }: AppIconProps) {
  const paths: Record<AppIconName, ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m3 16 5-5 4 4 3-3 6 6" />
        <circle cx="15.5" cy="8.5" r="1.5" />
      </>
    ),
    gallery: (
      <>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
      </>
    ),
    chat: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H8l-4 3.5V5.5Z" />,
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    details: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 19h16" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    edit: <path d="m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10L4 20Z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    announcement: (
      <>
        <path d="m4 13 2 6h3l-1-6M4 9v4h4l9 4V5L8 9H4Z" />
        <path d="M20 9v4" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8-1.9-.9L2.9 6l.9 1.9L3 9.8l-2 .7v3l2 .7.8 1.9-.9 1.9L5 20.1l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9.8-1.9 2-.7Z" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    code: (
      <>
        <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
      </>
    ),
    layout: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16M9 10h12" />
      </>
    ),
    heart: (
      <path d="M12 20.5s-7-4.4-7-10a4.2 4.2 0 0 1 7-3.1A4.2 4.2 0 0 1 19 10.5c0 5.6-7 10-7 10Z" />
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </>
    ),
    moon: (
      <path d="M20.4 14.5A8.5 8.5 0 0 1 9.5 3.6a8.5 8.5 0 1 0 10.9 10.9Z" />
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
        <path d="M19 15v4M17 17h4M5 16v2.5M3.75 17.25h2.5" />
      </>
    ),
    canvas: (
      <>
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="14" width="7" height="6" rx="1.5" />
        <path d="M10 7h3a2 2 0 0 1 2 2v3M14 17h-3a2 2 0 0 1-2-2v-3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5M6.1 8a7 7 0 0 1 11.5-1.7L20 9M4 15l2.4 2.7A7 7 0 0 0 18 16" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    maximize: (
      <>
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
      </>
    ),
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "arrow-left": <path d="m15 18-6-6 6-6M9 12h11" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    check: <path d="m5 12 5 5L20 7" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
