"use client";

import { Plus, Replace, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideElement } from "@/types/canvas";
import { LayerPanel } from "@/components/editor/LayerPanel";

type Props = {
  slideElements: SlideElement[];
  selectedIds: string[];
  backgroundColor: string;
  onBackgroundColor: (color: string) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onAlign: (dir: "left" | "right" | "top" | "bottom" | "center") => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
  onSelectLayer: (id: string) => void;
  onReorderLayer: (from: number, to: number) => void;
  onToggleVisibility: (id: string, hidden: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onDuplicate: () => void;
  onRegenerateImage: () => void;
  onReplaceImage: (file: File) => void;
};

const FONT_OPTIONS = ["Inter", "Poppins", "Playfair Display"] as const;

export function CanvasSidebar({
  slideElements,
  selectedIds,
  backgroundColor,
  onBackgroundColor,
  onUpdateElement,
  onAlign,
  onDistribute,
  onSelectLayer,
  onReorderLayer,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onRegenerateImage,
  onReplaceImage,
}: Props) {
  const selected = slideElements.find((el) => selectedIds[0] === el.id);

  return (
    <div className="w-full h-full bg-card border-l border-border p-3 space-y-4 overflow-y-auto">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Canvas Tools</h3>
        <p className="text-[11px] text-muted-foreground">Desktop-first visual editor</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Background
        </p>
        <input
          type="color"
          value={backgroundColor}
          onChange={(evt) => onBackgroundColor(evt.target.value)}
          className="w-full h-9 rounded-md border border-border bg-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" className="text-[11px]" onClick={() => onAlign("left")}>
          Align Left
        </Button>
        <Button size="sm" variant="secondary" className="text-[11px]" onClick={() => onAlign("right")}>
          Align Right
        </Button>
        <Button size="sm" variant="secondary" className="text-[11px]" onClick={() => onAlign("top")}>
          Align Top
        </Button>
        <Button size="sm" variant="secondary" className="text-[11px]" onClick={() => onAlign("bottom")}>
          Align Bottom
        </Button>
        <Button size="sm" variant="secondary" className="text-[11px]" onClick={() => onAlign("center")}>
          Align Center
        </Button>
        <Button size="sm" variant="outline" className="text-[11px]" onClick={onDuplicate}>
          Duplicate
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" className="text-[11px]" onClick={() => onDistribute("horizontal")}>
          Distribute H
        </Button>
        <Button size="sm" variant="outline" className="text-[11px]" onClick={() => onDistribute("vertical")}>
          Distribute V
        </Button>
      </div>

      {selected?.type === "text" && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Text
          </p>
          <textarea
            value={selected.text}
            onChange={(evt) => onUpdateElement(selected.id, { text: evt.target.value })}
            className="w-full min-h-20 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selected.fontFamily}
              onChange={(evt) =>
                onUpdateElement(selected.id, {
                  fontFamily: evt.target.value as "Inter" | "Poppins" | "Playfair Display",
                })
              }
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={selected.fontSize}
              onChange={(evt) => onUpdateElement(selected.id, { fontSize: Number(evt.target.value) || 16 })}
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
            <input
              type="color"
              value={selected.fill}
              onChange={(evt) => onUpdateElement(selected.id, { fill: evt.target.value })}
              className="h-8 rounded-md border border-border bg-background"
            />
            <select
              value={selected.align ?? "left"}
              onChange={(evt) => onUpdateElement(selected.id, { align: evt.target.value as "left" | "center" | "right" })}
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <input
              type="number"
              step="0.05"
              value={selected.lineHeight ?? 1.3}
              onChange={(evt) => onUpdateElement(selected.id, { lineHeight: Number(evt.target.value) || 1.3 })}
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
            <input
              type="number"
              step="0.1"
              value={selected.letterSpacing ?? 0}
              onChange={(evt) => onUpdateElement(selected.id, { letterSpacing: Number(evt.target.value) || 0 })}
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
          </div>
        </div>
      )}

      {selected?.type === "image" && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Image
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selected.opacity ?? 1}
              onChange={(evt) => onUpdateElement(selected.id, { opacity: Number(evt.target.value) })}
            />
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={selected.cornerRadius ?? 0}
              onChange={(evt) => onUpdateElement(selected.id, { cornerRadius: Number(evt.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="text-[11px]" onClick={onRegenerateImage}>
              <WandSparkles className="w-3.5 h-3.5 mr-1" />
              Regen
            </Button>
            <label className="h-8 inline-flex items-center justify-center rounded-md border border-border text-[11px] px-2 cursor-pointer">
              <Replace className="w-3.5 h-3.5 mr-1" />
              Replace
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(evt) => {
                  const file = evt.target.files?.[0];
                  if (file) onReplaceImage(file);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {!selected && (
        <div className="rounded-md border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          Select an element to edit its style, opacity, or text properties.
        </div>
      )}

      <LayerPanel
        elements={slideElements}
        selectedIds={selectedIds}
        onSelect={onSelectLayer}
        onReorder={onReorderLayer}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
      />

      <Button variant="outline" size="sm" className="w-full text-[11px]">
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add Element
      </Button>
    </div>
  );
}
