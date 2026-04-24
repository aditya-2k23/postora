"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Replace, WandSparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideElement } from "@/types/canvas";
import { LayerPanel } from "@/components/editor/LayerPanel";
import { cn, normalizeColor } from "@/lib/utils";

type Props = {
  slideElements: SlideElement[];
  selectedIds: string[];
  backgroundColor: string;
  onBackgroundColor: (color: string) => void;
  onUpdateElement: (
    id: string,
    updates: Partial<SlideElement>,
    options?: {
      applyScope?: "single" | "matching-selection";
      pushHistory?: boolean;
    },
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
  onAddElement: (type: "text" | "image" | "shape") => void;
  isRegenerating?: boolean;
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
  onAddElement,
  isRegenerating = false,
}: Props) {
  const lastSelectedIdRef = useRef<string | null>(selectedIds[0] || null);

  useEffect(() => {
    if (selectedIds[0]) {
      lastSelectedIdRef.current = selectedIds[0];
    }
  }, [selectedIds]);

  const selected = slideElements.find((el) => selectedIds[0] === el.id);
  const selectedText = selected?.type === "text" ? (selected as any) : null;

  // Local state for color inputs to prevent flooding
  const [localCanvasBg, setLocalCanvasBg] = useState(backgroundColor);
  const [localFill, setLocalFill] = useState(selectedText?.fill || "#000000");

  useEffect(() => {
    setLocalCanvasBg(backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    if (selectedText?.fill) {
      setLocalFill(selectedText.fill);
    }
  }, [selected?.id, selectedText?.fill]);

  const [localText, setLocalText] = useState(selectedText?.text || "");

  // Refs to keep global listeners updated without re-binding
  const localTextRef = useRef(localText);
  const localFillRef = useRef(localFill);
  const localCanvasBgRef = useRef(localCanvasBg);

  useEffect(() => {
    localTextRef.current = localText;
  }, [localText]);

  useEffect(() => {
    localFillRef.current = localFill;
  }, [localFill]);

  useEffect(() => {
    localCanvasBgRef.current = localCanvasBg;
  }, [localCanvasBg]);

  const selectedElements = slideElements.filter((el) =>
    selectedIds.includes(el.id),
  );

  const hasMultiSameTypeSelection =
    selectedElements.length > 1 &&
    selectedElements.every((el) => el.type === selectedElements[0].type);

  useEffect(() => {
    if (selectedText?.text !== undefined) {
      setLocalText(selectedText.text);
    }
  }, [selected?.id, selectedText?.text]);

  const applyStyleUpdate = useCallback(
    (updates: Partial<SlideElement>, pushHistory = true) => {
      const targetId = selected?.id || lastSelectedIdRef.current;
      if (!targetId) return;

      onUpdateElement(targetId, updates, {
        applyScope: hasMultiSameTypeSelection ? "matching-selection" : "single",
        pushHistory,
      });
    },
    [onUpdateElement, selected, hasMultiSameTypeSelection],
  );

  // Global click listener to commit color changes when clicking outside
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      // If clicking outside the sidebar or on the canvas, commit the local color
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.closest("select");

      if (!isInput) {
        const commitId = lastSelectedIdRef.current;
        const original = slideElements.find((el) => el.id === commitId);

        if (commitId && original) {
          if (
            original.type === "text" &&
            localFillRef.current !== original.fill
          ) {
            onUpdateElement(
              commitId,
              { fill: localFillRef.current },
              {
                applyScope: "single",
                pushHistory: true,
              },
            );
          }
          if (
            original.type === "text" &&
            localTextRef.current !== original.text
          ) {
            onUpdateElement(
              commitId,
              { text: localTextRef.current },
              {
                applyScope: "single",
                pushHistory: true,
              },
            );
          }
        }

        if (localCanvasBgRef.current !== backgroundColor) {
          onBackgroundColor(localCanvasBgRef.current);
        }
      }
    };

    window.addEventListener("mousedown", handleGlobalMouseDown);
    return () => window.removeEventListener("mousedown", handleGlobalMouseDown);
  }, [backgroundColor, onBackgroundColor, onUpdateElement, slideElements]);

  const parseNumericInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (
      trimmed.length === 0 ||
      trimmed === "-" ||
      trimmed === "." ||
      trimmed === "-."
    ) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const commitFontSize = (value: string, inputEl: HTMLInputElement) => {
    const targetId = selected?.id || lastSelectedIdRef.current;
    const el = slideElements.find((e) => e.id === targetId);
    if (el?.type !== "text") return;
    const parsed = parseNumericInput(value);
    if (parsed === null) {
      inputEl.value = String(selectedText.fontSize);
      return;
    }
    applyStyleUpdate({ fontSize: parsed });
    inputEl.value = String(parsed);
  };

  const commitLineHeight = (value: string, inputEl: HTMLInputElement) => {
    const targetId = selected?.id || lastSelectedIdRef.current;
    const el = slideElements.find((e) => e.id === targetId);
    if (el?.type !== "text") return;
    const parsed = parseNumericInput(value);
    const fallback = el.lineHeight ?? 1.3;
    if (parsed === null) {
      inputEl.value = String(fallback);
      return;
    }
    applyStyleUpdate({ lineHeight: parsed });
    inputEl.value = String(parsed);
  };

  const commitLetterSpacing = (value: string, inputEl: HTMLInputElement) => {
    const targetId = selected?.id || lastSelectedIdRef.current;
    const el = slideElements.find((e) => e.id === targetId);
    if (el?.type !== "text") return;
    const parsed = parseNumericInput(value);
    const fallback = el.letterSpacing ?? 0;
    if (parsed === null) {
      inputEl.value = String(fallback);
      return;
    }
    applyStyleUpdate({ letterSpacing: parsed });
    inputEl.value = String(parsed);
  };

  const isDefaultBackground = backgroundColor.trim().length === 0;
  const colorPickerValue = HEX_COLOR.test(backgroundColor.trim())
    ? backgroundColor.trim()
    : "#ffffff";

  return (
    <div className="w-full h-full bg-card border-l border-border p-3 space-y-4 overflow-y-auto canvas-sidebar">
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
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-border/80 px-2 text-[10px] font-semibold tracking-wide text-foreground/90 transition-colors hover:bg-muted/70"
              onClick={(e) => {
                const input = e.currentTarget
                  .nextElementSibling as HTMLInputElement;
                input.click();
              }}
            >
              Custom Theme
            </button>
            <input
              type="color"
              value={localCanvasBg || "#ffffff"}
              onChange={(evt) => setLocalCanvasBg(evt.target.value)}
              onBlur={() => {
                if (localCanvasBg !== backgroundColor) {
                  onBackgroundColor(localCanvasBg);
                }
              }}
              className="absolute inset-0 opacity-0 pointer-events-none"
              aria-label="Pick custom canvas background color"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="Use default canvas background"
            aria-label="Use default background"
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
                aria-label={`Set background to ${color.label}`}
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

          <div className="relative h-10 w-10">
            <button
              type="button"
              aria-label="Custom background color"
              className={cn(
                "h-full w-full rounded-full border border-dashed border-border/80 text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground hover:scale-105 flex items-center justify-center",
                localCanvasBg !== backgroundColor &&
                  !isDefaultBackground &&
                  "ring-2 ring-primary ring-offset-2",
              )}
              onClick={(e) => {
                const input = e.currentTarget
                  .nextElementSibling as HTMLInputElement;
                input.click();
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
            <input
              type="color"
              value={localCanvasBg || "#ffffff"}
              onChange={(evt) => setLocalCanvasBg(evt.target.value)}
              onBlur={() => {
                if (localCanvasBg !== backgroundColor) {
                  onBackgroundColor(localCanvasBg);
                }
              }}
              className="absolute inset-0 opacity-0 pointer-events-none"
              aria-label="Add custom background color"
            />
          </div>
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
            value={localText}
            onChange={(evt) => setLocalText(evt.target.value)}
            onBlur={() => {
              const commitId = lastSelectedIdRef.current;
              const original = slideElements.find((el) => el.id === commitId);
              if (
                commitId &&
                original &&
                original.type === "text" &&
                localText !== original.text
              ) {
                onUpdateElement(
                  commitId,
                  { text: localText },
                  {
                    applyScope: "single",
                    pushHistory: true,
                  },
                );
              }
            }}
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
              key={`${selected.id}-font-size`}
              type="number"
              defaultValue={selected.fontSize}
              onBlur={(evt) =>
                commitFontSize(evt.currentTarget.value, evt.currentTarget)
              }
              onKeyDown={(evt) => {
                if (evt.key === "Enter") {
                  evt.preventDefault();
                  commitFontSize(evt.currentTarget.value, evt.currentTarget);
                }
              }}
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Set text color to black"
                aria-pressed={normalizeColor(localFill) === "#000000"}
                className={cn(
                  "h-8 w-8 rounded-full border border-border bg-[#000000] transition-all hover:scale-110 shadow-sm",
                  normalizeColor(localFill) === "#000000" &&
                    "ring-2 ring-primary ring-offset-2",
                )}
                onClick={() => {
                  const color = "#000000";
                  setLocalFill(color);
                  onUpdateElement(
                    selected.id,
                    { fill: color },
                    {
                      applyScope: hasMultiSameTypeSelection
                        ? "matching-selection"
                        : "single",
                    },
                  );
                }}
              />
              <button
                type="button"
                aria-label="Set text color to white"
                aria-pressed={normalizeColor(localFill) === "#ffffff"}
                className={cn(
                  "h-8 w-8 rounded-full border border-border bg-[#ffffff] transition-all hover:scale-110 shadow-sm",
                  normalizeColor(localFill) === "#ffffff" &&
                    "ring-2 ring-primary ring-offset-2",
                )}
                onClick={() => {
                  const color = "#ffffff";
                  setLocalFill(color);
                  onUpdateElement(
                    selected.id,
                    { fill: color },
                    {
                      applyScope: hasMultiSameTypeSelection
                        ? "matching-selection"
                        : "single",
                    },
                  );
                }}
              />
              <div className="relative h-8 w-8">
                <button
                  type="button"
                  aria-label="Pick custom text color"
                  aria-pressed={
                    !["#000000", "#ffffff"].includes(normalizeColor(localFill))
                  }
                  className={cn(
                    "h-full w-full rounded-full border border-dashed border-border/80 text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground hover:scale-110 flex items-center justify-center overflow-hidden",
                    !["#000000", "#ffffff"].includes(
                      normalizeColor(localFill),
                    ) && "ring-2 ring-primary ring-offset-2",
                  )}
                  onClick={(e) => {
                    const input = e.currentTarget
                      .nextElementSibling as HTMLInputElement;
                    input.click();
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="color"
                  value={normalizeColor(localFill)}
                  onChange={(evt) =>
                    setLocalFill(normalizeColor(evt.target.value))
                  }
                  onBlur={() => {
                    const commitId = lastSelectedIdRef.current;
                    const original = slideElements.find(
                      (el) => el.id === commitId,
                    );
                    if (
                      original?.type === "text" &&
                      normalizeColor(localFill) !==
                        normalizeColor(original.fill)
                    ) {
                      applyStyleUpdate({ fill: normalizeColor(localFill) });
                    }
                  }}
                  className="absolute inset-0 opacity-0 pointer-events-none"
                  aria-label="Text color"
                />
              </div>
            </div>
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
              key={`${selected.id}-line-height`}
              type="number"
              step="0.05"
              defaultValue={selected.lineHeight ?? 1.3}
              onBlur={(evt) =>
                commitLineHeight(evt.currentTarget.value, evt.currentTarget)
              }
              onKeyDown={(evt) => {
                if (evt.key === "Enter") {
                  evt.preventDefault();
                  commitLineHeight(evt.currentTarget.value, evt.currentTarget);
                }
              }}
              className="h-8 rounded-md border border-border bg-background text-xs px-2"
            />
            <input
              key={`${selected.id}-letter-spacing`}
              type="number"
              step="0.1"
              defaultValue={selected.letterSpacing ?? 0}
              onBlur={(evt) =>
                commitLetterSpacing(evt.currentTarget.value, evt.currentTarget)
              }
              onKeyDown={(evt) => {
                if (evt.key === "Enter") {
                  evt.preventDefault();
                  commitLetterSpacing(
                    evt.currentTarget.value,
                    evt.currentTarget,
                  );
                }
              }}
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
              aria-label="Image opacity"
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
              aria-label="Corner radius"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[11px]"
              onClick={onRegenerateImage}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <WandSparkles className="w-3.5 h-3.5 mr-1" />
              )}
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

      <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase px-1">
          Insert
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-9"
            onClick={() => onAddElement("text")}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Text
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-9"
            onClick={() => onAddElement("shape")}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Shape
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-9"
            onClick={() => onAddElement("image")}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Image
          </Button>
        </div>
      </div>
    </div>
  );
}
