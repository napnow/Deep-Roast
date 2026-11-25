"use client";

import AdminStylesCard from "./AdminStylesCard";
import AdminStyleTestCard from "./AdminStyleTestCard";
import AdminImageCostsCard from "./AdminImageCostsCard";

export default function AdminAiCapabilitiesPage() {
  return (
    <div className="admin-workspace-page space-y-5 animate-fade-up">
      <header className="admin-page-heading !mb-6">
        <div>
          <p className="admin-overline">MODELS & STYLES · AI 能力</p>
          <h1>AI 能力</h1>
          <p>管理各生图模型计费策略与图生图风格预设，并在发布前完成效果验证。</p>
        </div>
      </header>
      <AdminImageCostsCard />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <AdminStylesCard />
        <AdminStyleTestCard />
      </div>
    </div>
  );
}
