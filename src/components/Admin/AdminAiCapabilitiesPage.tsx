"use client";

import AdminStylesCard from "./AdminStylesCard";
import AdminStyleTestCard from "./AdminStyleTestCard";

export default function AdminAiCapabilitiesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-up">
      <header>
        <p className="admin-kicker">AI Capabilities</p>
        <h1 className="admin-title text-[1.85rem] mt-1.5">AI 能力</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          管理图生图风格，并在发布前完成效果验证。
        </p>
      </header>
      <AdminStylesCard />
      <AdminStyleTestCard />
    </div>
  );
}
