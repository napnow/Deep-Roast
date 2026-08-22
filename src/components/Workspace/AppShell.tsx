"use client";

import type { ReactNode } from "react";

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
}

export default function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="workspace-shell">
      {header}
      <main className="workspace-main">{children}</main>
    </div>
  );
}
