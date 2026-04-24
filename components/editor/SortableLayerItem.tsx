"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
} from "lucide-react";
import type { SlideElement } from "@/types/canvas";
import { cn } from "@/lib/utils";

type SortableItemProps = {
  id: string;
  element: SlideElement;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggleVisibility: (id: string, hidden: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
};

export function SortableLayerItem({
  id,
  element,
  index,
  total,
  isSelected,
  onSelect,
  onReorder,
  onToggleVisibility,
  onToggleLock,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const actualIndex = index;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(element.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(element.id);
        }
      }}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors duration-200 group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50",
        isSelected
          ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/20"
          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50",
        isDragging &&
          "opacity-50 scale-[1.02] shadow-lg border-primary bg-background ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-none">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(evt) => evt.stopPropagation()}
          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted-foreground/10 transition-colors shrink-0 outline-none pointer-events-auto"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
        </button>

        <span className="flex-1 text-left truncate font-medium">
          {element.type === "shape"
            ? `${element.type}:${element.shape}`
            : element.type}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label={element.hidden ? "Show layer" : "Hide layer"}
          onClick={(evt) => {
            evt.stopPropagation();
            onToggleVisibility(element.id, !element.hidden);
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
        >
          {element.hidden ? (
            <EyeOff className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )}
        </button>
        <button
          type="button"
          aria-label={element.locked ? "Unlock layer" : "Lock layer"}
          onClick={(evt) => {
            evt.stopPropagation();
            onToggleLock(element.id, !element.locked);
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
        >
          {element.locked ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
        </button>

        <div className="flex items-center ml-0.5 border-l border-border/50 pl-1.5 gap-0.5">
          <button
            type="button"
            aria-label="Move layer up"
            disabled={actualIndex === total - 1}
            onClick={(evt) => {
              evt.stopPropagation();
              onReorder(actualIndex, actualIndex + 1);
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            aria-label="Move layer down"
            disabled={actualIndex === 0}
            onClick={(evt) => {
              evt.stopPropagation();
              onReorder(actualIndex, actualIndex - 1);
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
