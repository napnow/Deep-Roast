"use client";

import {
  MOBILE_PRIMARY_WORKSPACES,
  type MobilePrimaryWorkspace,
} from "./mobile-workspace-ui";
import { AppIcon, type AppIconName } from "@/components/ui/icons";

interface MobileWorkspaceNavProps {
  activeWorkspace: MobilePrimaryWorkspace;
  onSelect: (workspace: MobilePrimaryWorkspace) => void;
}

const WORKSPACE_ICONS: Record<MobilePrimaryWorkspace, AppIconName> = {
  generate: "image",
  chat: "chat",
  gallery: "history",
  account: "user",
};

export default function MobileWorkspaceNav({
  activeWorkspace,
  onSelect,
}: MobileWorkspaceNavProps) {
  return (
    <nav className="mobile-workspace-nav md:hidden" aria-label="主工作区">
      <div role="tablist" className="mobile-workspace-nav__tabs">
        {MOBILE_PRIMARY_WORKSPACES.map((item) => {
          const selected = activeWorkspace === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(item.id)}
              className={selected ? "is-active" : undefined}
            >
              <span className="mobile-workspace-nav__icon" aria-hidden="true">
                <AppIcon name={WORKSPACE_ICONS[item.id]} size={20} strokeWidth={1.7} />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
