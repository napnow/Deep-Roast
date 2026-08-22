"use client";

import AdminAnnouncementsCard from "./AdminAnnouncementsCard";
import AdminDonationCard from "./AdminDonationCard";
import AdminSiteSettingsCard from "./AdminSiteSettingsCard";

export default function AdminSiteContentPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-up">
      <header>
        <p className="admin-kicker">Site & Content</p>
        <h1 className="admin-title text-[1.85rem] mt-1.5">站点与内容</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          集中管理注册、联系方式、公告和赞赏入口。
        </p>
      </header>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <AdminSiteSettingsCard />
        <AdminAnnouncementsCard />
      </div>
      <AdminDonationCard />
    </div>
  );
}
