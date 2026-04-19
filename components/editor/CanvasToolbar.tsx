"use client";

import {
  Copy,
  Grid2X2,
  MoveUpRight,
  MousePointer2,
  Redo2,
  Ruler,
  RotateCcwSquare,
  Square,
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
  gridEnabled: boolean;
  rulerEnabled: boolean;
  onToggleGrid: () => void;
  onToggleRuler: () => void;
};

const tools: Array<{
  id: CanvasTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
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
  gridEnabled,
  rulerEnabled,
  onToggleGrid,
  onToggleRuler,
}: Props) {
  return (
    <div className="h-12 border-b border-border px-3 flex items-center justify-between bg-card/50 shrink-0 gap-2">
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            aria-label={tool.label}
            className={cn(
              "h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 transition-colors",
              activeTool === tool.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            <tool.icon className="w-3.5 h-3.5" />
            {tool.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onCopy}
          disabled={!hasSelection}
          title="Copy selected"
          aria-label="Copy selected"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste"
          aria-label="Paste"
        >
          Paste
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate selected"
          aria-label="Duplicate selected"
        >
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onBringForward}
          disabled={!hasSelection}
          title="Bring forward"
          aria-label="Bring forward"
        >
          <MoveUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onSendBackward}
          disabled={!hasSelection}
          title="Send backward"
          aria-label="Send backward"
        >
          <RotateCcwSquare className="w-3.5 h-3.5" />
        </Button>
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
          title="Toggle grid"
          aria-label="Toggle grid"
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
          title="Toggle ruler"
          aria-label="Toggle ruler"
        >
          <Ruler className="w-3.5 h-3.5" />
          Ruler
        </Button>
      </div>
    </div>
  );
}
