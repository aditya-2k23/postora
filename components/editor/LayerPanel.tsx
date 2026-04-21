"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import type { SlideElement } from "@/types/canvas";
import { cn } from "@/lib/utils";

type Props = {
  elements: SlideElement[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggleVisibility: (id: string, hidden: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
};

export function LayerPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onToggleVisibility,
  onToggleLock,
}: Props) {
  const layers = [...elements].map((el, index) => ({ el, index })).reverse();

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        Layers
      </p>
      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
        {layers.map(({ el, index }) => {
          const actualIndex = index;
          const isSelected = selectedIds.includes(el.id);
          return (
            <div
              key={el.id}
              className={cn(
                "w-full rounded-md border px-2 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors",
                isSelected
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(el.id)}
                className="flex-1 text-left truncate hover:underline outline-none focus-visible:underline"
              >
                {el.type === "shape" ? `${el.type}:${el.shape}` : el.type}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={el.hidden ? "Show layer" : "Hide layer"}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    onToggleVisibility(el.id, !el.hidden);
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary outline-none"
                >
                  {el.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  aria-label={el.locked ? "Unlock layer" : "Lock layer"}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    onToggleLock(el.id, !el.locked);
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary outline-none"
                >
                  {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  aria-label="Move layer up"
                  disabled={actualIndex === elements.length - 1}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    onReorder(actualIndex, actualIndex + 1);
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-primary outline-none"
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
                  className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-primary outline-none"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
