"use client";

import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Grid2X2,
  Hand,
  MoveUpRight,
  MousePointer2,
  Redo2,
  Ruler,
  RotateCcwSquare,
  Square,
  Trash2,
  Type,
  Undo2,
  Wallpaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanvasTool } from "@/types/canvas";
import { cn } from "@/lib/utils";

type Props = {
  activeTool: CanvasTool;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  canPaste: boolean;
  onToolChange: (tool: CanvasTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDelete: () => void;
  gridEnabled: boolean;
  rulerEnabled: boolean;
  onToggleGrid: () => void;
  onToggleRuler: () => void;
};

const tools: Array<{
  id: CanvasTool;
  label: string;
  icon: typeof MousePointer2;
  shortcut?: string;
}> = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "grab", label: "Grab", icon: Hand, shortcut: "G" },
  { id: "text", label: "Text", icon: Type, shortcut: "T" },
  { id: "shape", label: "Shape", icon: Square },
  { id: "image", label: "Image", icon: Wallpaper },
];

export function CanvasToolbar({
  activeTool,
  canUndo,
  canRedo,
  hasSelection,
  canPaste,
  onToolChange,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onDelete,
  gridEnabled,
  rulerEnabled,
  onToggleGrid,
  onToggleRuler,
}: Props) {
  return (
    <div className="h-12 border-b border-border px-3 flex items-center justify-between bg-card/50 shrink-0 gap-2 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1 shrink-0">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={
              tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label
            }
            aria-label={tool.label}
            className={cn(
              "h-8 px-2.5 rounded-md text-xs flex items-center justify-start transition-all duration-200 shrink-0 overflow-hidden",
              activeTool === tool.id
                ? "bg-primary/15 text-primary w-[88px]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 w-9",
            )}
          >
            <tool.icon className="w-3.5 h-3.5 shrink-0" />
            <span
              className={cn(
                "ml-2 transition-all duration-200 whitespace-nowrap",
                activeTool === tool.id
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 pointer-events-none w-0 ml-0",
              )}
            >
              {tool.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {/* History Group */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-border/50 mx-1.5" />

        {/* Clipboard Group */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onCopy}
            disabled={!hasSelection}
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onPaste}
            disabled={!canPaste}
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onDuplicate}
            disabled={!hasSelection}
            title="Duplicate (Ctrl+D)"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-border/50 mx-1.5" />

        {/* Layering Group */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onBringForward}
            disabled={!hasSelection}
            title="Bring Forward"
          >
            <MoveUpRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onSendBackward}
            disabled={!hasSelection}
            title="Send Backward"
          >
            <RotateCcwSquare className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-border/50 mx-1.5" />

        {/* Delete Group */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-white hover:bg-destructive/90"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete (Del/Backspace)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-4 bg-border/50 mx-1.5" />

        {/* View Settings Group */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 text-[11px] gap-1.5 border",
              gridEnabled
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-border",
            )}
            onClick={onToggleGrid}
            title="Toggle Grid (Shift+G)"
          >
            <Grid2X2 className="w-3.5 h-3.5" />
            Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 text-[11px] gap-1.5 border",
              rulerEnabled
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-border",
            )}
            onClick={onToggleRuler}
            title="Toggle Ruler (Shift+R)"
          >
            <Ruler className="w-3.5 h-3.5" />
            Ruler
          </Button>
        </div>
      </div>
    </div>
  );
}
