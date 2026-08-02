"use client";

import { useEffect } from "react";
import AnnouncementList from "@/components/AnnouncementList";
import { useAnnouncements } from "@/hooks/useAnnouncements";

/** 手机端「公告」Tab：全屏查看站点公告（与图库同级的页面） */
export default function AnnouncementTab() {
  const ann = useAnnouncements();

  useEffect(() => {
    ann.load();
    ann.markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pt-4 pb-3">
        <h2
          className="text-[15px] font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          站点公告
        </h2>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {ann.loading
            ? "加载中…"
            : `共 ${ann.items.length} 条公告`}
        </p>
      </div>
      <div className="px-3 pb-4">
        <AnnouncementList items={ann.items} loading={ann.loading} />
      </div>
    </div>
  );
}
