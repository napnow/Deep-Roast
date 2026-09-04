"use client";

import { useState } from "react";
import { AppIcon } from "@/components/ui/icons";

export default function ImageActionMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="asset-menu">
      <button
        type="button"
        className="icon-button"
        aria-label="更多图片操作"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon name="more" />
      </button>
      {open ? (
        <button
          type="button"
          className="asset-menu__delete"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
        >
          <AppIcon name="trash" size={14} /> 删除图片
        </button>
      ) : null}
    </div>
  );
}
