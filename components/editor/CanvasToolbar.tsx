"use client";

import {
  Copy,
  Grid2X2,
  MoveUpRight,
  MousePointer2,
  Redo2,
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

const tools: Array<{ id: CanvasTool; label: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
  { id: "shape", label: "Shape", icon: Square },
  { id: "image", label: "Image", icon: Wallpaper },
];

export function CanvasToolbar({
  activeTool,
  canUndo,
  canRedo,
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
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onCopy}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={onPaste}>
          Paste
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onBringForward}>
          <MoveUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onSendBackward}>
          <RotateCcwSquare className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={gridEnabled ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={onToggleGrid}
        >
          <Grid2X2 className="w-3.5 h-3.5 mr-1" />
          Grid
        </Button>
        <Button
          variant={rulerEnabled ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={onToggleRuler}
        >
          Ruler
        </Button>
      </div>
    </div>
  );
}
