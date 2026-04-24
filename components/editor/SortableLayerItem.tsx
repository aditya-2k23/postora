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
      className={cn(
        "w-full rounded-md border text-[11px] flex items-center justify-between gap-1 transition-colors duration-200 group relative outline-none",
        isSelected
          ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/20"
          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50",
        isDragging &&
          "opacity-50 scale-[1.02] shadow-lg border-primary bg-background ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-1.5 flex-1 min-w-0 pl-1.5 py-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted-foreground/10 transition-colors shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => onSelect(element.id)}
          aria-pressed={isSelected}
          className="flex-1 text-left truncate font-medium hover:text-foreground transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-0.5"
        >
          {element.type === "shape"
            ? `${element.type}:${element.shape}`
            : element.type}
        </button>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 pr-1.5">
        <button
          type="button"
          aria-label={element.hidden ? "Show layer" : "Hide layer"}
          onClick={() => onToggleVisibility(element.id, !element.hidden)}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
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
          onClick={() => onToggleLock(element.id, !element.locked)}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted-foreground/10 focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
        >
          {element.locked ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
        </button>

        <div className="flex items-center ml-0.5 border-l border-border/50 pl-1 gap-0.5">
          <button
            type="button"
            aria-label="Move layer up"
            disabled={actualIndex === total - 1}
            onClick={() => onReorder(actualIndex, actualIndex + 1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            aria-label="Move layer down"
            disabled={actualIndex === 0}
            onClick={() => onReorder(actualIndex, actualIndex - 1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
