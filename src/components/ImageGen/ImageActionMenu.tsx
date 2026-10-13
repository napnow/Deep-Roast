"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/icons";
export default function ImageActionMenu({
  onDelete,
}: {
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    action = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", pointer, true);
    return () => document.removeEventListener("pointerdown", pointer, true);
  }, [open]);
  return (
    <div
      className="asset-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => action.current?.focus());
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label="更多图片操作"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon name="more" />
      </button>
      {open && (
        <div id={id} role="group" aria-label="图片操作">
          <button
            ref={action}
            type="button"
            className="asset-menu__delete"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              onDelete();
            }}
          >
            <AppIcon name="trash" size={14} />
            删除图片
          </button>
        </div>
      )}
    </div>
  );
}
