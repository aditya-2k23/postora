"use client";

import { Plus, Replace, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideElement } from "@/types/canvas";
import { LayerPanel } from "@/components/editor/LayerPanel";
import { cn } from "@/lib/utils";

type Props = {
  slideElements: SlideElement[];
  selectedIds: string[];
  backgroundColor: string;
  onBackgroundColor: (color: string) => void;
  onUpdateElement: (
    id: string,
    updates: Partial<SlideElement>,
    applyScope?: "single" | "matching-selection",
  ) => void;
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
const PRESET_BACKGROUND_COLORS = [
  { label: "Periwinkle", value: "#8EA2FF" },
  { label: "Mint", value: "#3FE88A" },
  { label: "Charcoal", value: "#1F2937" },
  { label: "Snow", value: "#F8FAFC" },
] as const;
const HEX_COLOR = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

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
  const selectedElements = slideElements.filter((el) =>
    selectedIds.includes(el.id),
  );
  const hasMultiSameTypeSelection =
    selectedElements.length > 1 &&
    selectedElements.every((el) => el.type === selectedElements[0].type);

  const applyStyleUpdate = (updates: Partial<SlideElement>) => {
    if (!selected) return;
    onUpdateElement(
      selected.id,
      updates,
      hasMultiSameTypeSelection ? "matching-selection" : "single",
    );
  };

  const isDefaultBackground = backgroundColor.trim().length === 0;
  const colorPickerValue = HEX_COLOR.test(backgroundColor.trim())
    ? backgroundColor.trim()
    : "#ffffff";

  return (
    <div className="w-full h-full bg-card border-l border-border p-3 space-y-4 overflow-y-auto">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Canvas Tools</h3>
        <p className="text-[11px] text-muted-foreground">
          Desktop-first visual editor
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Brand Colors
          </p>
          <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 px-2 text-[10px] font-semibold tracking-wide text-foreground/90 transition-colors hover:bg-muted/70">
            Custom Theme
            <input
              type="color"
              value={colorPickerValue}
              onChange={(evt) => onBackgroundColor(evt.target.value)}
              className="sr-only"
              aria-label="Pick custom canvas background color"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="Use default canvas background"
            onClick={() => onBackgroundColor("")}
            className={cn(
              "relative h-10 w-10 overflow-hidden rounded-full border border-border/80",
              "transition-all duration-150",
              isDefaultBackground
                ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                : "hover:scale-[1.03]",
            )}
          >
            <span className="absolute inset-0 bg-[linear-gradient(45deg,#E5E7EB_25%,transparent_25%,transparent_50%,#E5E7EB_50%,#E5E7EB_75%,transparent_75%,transparent)] [background-size:10px_10px]" />
          </button>

          {PRESET_BACKGROUND_COLORS.map((color) => {
            const selectedColor =
              !isDefaultBackground &&
              backgroundColor.toLowerCase() === color.value.toLowerCase();
            return (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => onBackgroundColor(color.value)}
                className={cn(
                  "h-10 w-10 rounded-full border border-black/10 transition-all duration-150",
                  selectedColor
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                    : "hover:scale-[1.03]",
                )}
                style={{ backgroundColor: color.value }}
              />
            );
          })}

          <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-dashed border-border/80 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
            <Plus className="h-4 w-4" />
            <input
              type="color"
              value={colorPickerValue}
              onChange={(evt) => onBackgroundColor(evt.target.value)}
              className="sr-only"
              aria-label="Add custom background color"
            />
          </label>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Grid and ruler marks stay visible on light and dark backgrounds.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="text-[11px]"
          onClick={() => onAlign("left")}
        >
          Align Left
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="text-[11px]"
          onClick={() => onAlign("right")}
        >
          Align Right
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="text-[11px]"
          onClick={() => onAlign("top")}
        >
          Align Top
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="text-[11px]"
          onClick={() => onAlign("bottom")}
        >
          Align Bottom
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="text-[11px]"
          onClick={() => onAlign("center")}
        >
          Align Center
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-[11px]"
          onClick={onDuplicate}
        >
          Duplicate
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-[11px]"
          onClick={() => onDistribute("horizontal")}
        >
          Distribute H
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-[11px]"
          onClick={() => onDistribute("vertical")}
        >
          Distribute V
        </Button>
      </div>

      {hasMultiSameTypeSelection ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-[10px] text-foreground/85">
          Style changes apply to all selected {selectedElements[0].type}{" "}
          elements.
        </div>
      ) : null}

      {selected?.type === "text" && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Text
          </p>
          <textarea
            value={selected.text}
            onChange={(evt) =>
              onUpdateElement(selected.id, { text: evt.target.value }, "single")
            }
            className="w-full min-h-20 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selected.fontFamily}
              onChange={(evt) =>
                applyStyleUpdate({
                  fontFamily: evt.target.value as
                    | "Inter"
                    | "Poppins"
                    | "Playfair Display",
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
              onChange={(evt) =>
                applyStyleUpdate({
                  fontSize: Number(evt.target.value) || 16,
                })
              }
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
            <input
              type="color"
              value={selected.fill}
              onChange={(evt) => applyStyleUpdate({ fill: evt.target.value })}
              className="h-8 rounded-md border border-border bg-background"
            />
            <select
              value={selected.align ?? "left"}
              onChange={(evt) =>
                applyStyleUpdate({
                  align: evt.target.value as "left" | "center" | "right",
                })
              }
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
              onChange={(evt) =>
                applyStyleUpdate({
                  lineHeight: Number(evt.target.value) || 1.3,
                })
              }
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
            <input
              type="number"
              step="0.1"
              value={selected.letterSpacing ?? 0}
              onChange={(evt) =>
                applyStyleUpdate({
                  letterSpacing: Number(evt.target.value) || 0,
                })
              }
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
              onChange={(evt) =>
                applyStyleUpdate({
                  opacity: Number(evt.target.value),
                })
              }
            />
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={selected.cornerRadius ?? 0}
              onChange={(evt) =>
                applyStyleUpdate({
                  cornerRadius: Number(evt.target.value),
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[11px]"
              onClick={onRegenerateImage}
            >
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
