"use client";

import AdminAnnouncementsCard from "./AdminAnnouncementsCard";
import AdminDonationCard from "./AdminDonationCard";
import AdminSiteSettingsCard from "./AdminSiteSettingsCard";
import AdminInvitationsCard from "./AdminInvitationsCard";

export default function AdminSiteContentPage() {
  return (
    <div className="admin-workspace-page space-y-5 animate-fade-up">
      <header className="admin-page-heading !mb-6">
        <div>
          <p className="admin-overline">SITE & CONTENT · 站点与内容</p>
          <h1>站点与内容</h1>
          <p>集中管理注册风控、积分激励、站点公告、邀请记录与打赏收款设置。</p>
        </div>
      </header>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <AdminSiteSettingsCard />
        <div className="space-y-4">
          <AdminAnnouncementsCard />
          <AdminDonationCard />
        </div>
      </div>
      <AdminInvitationsCard />
    </div>
  );
}
