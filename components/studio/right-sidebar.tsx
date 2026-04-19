"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export function RightSidebar() {
  const { themeSettings, updateTheme, cards, activeCardId } = useStudioStore();

  const hasSelection = activeCardId && cards.length > 0;
  const accent = themeSettings.primaryColor;

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">Appearance</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Context hint */}
        {!hasSelection && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Since no element is selected on global theme controls.
          </p>
        )}

        {/* Primary Color */}
        <div className="space-y-2.5">
          <Label className="text-xs font-medium">Primary Color</Label>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md border border-border cursor-pointer shadow-sm shrink-0"
              style={{ backgroundColor: accent }}
              onClick={() => {
                const input = document.getElementById("studio-color-input");
                if (input) (input as HTMLInputElement).click();
              }}
            />
            <input
              id="studio-color-input"
              type="color"
              value={accent}
              onChange={(e) => updateTheme({ primaryColor: e.target.value })}
              className="sr-only"
            />
            <div className="flex items-center bg-muted/50 border border-border rounded-md px-2.5 py-1.5 flex-1">
              <span className="text-xs font-mono text-foreground/80">
                {accent.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Base Font Size */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Base Font Size</Label>
            <span className="text-xs font-medium text-muted-foreground">
              {themeSettings.fontSize}px
            </span>
          </div>
          <Slider
            value={[themeSettings.fontSize]}
            min={12}
            max={32}
            step={1}
            onValueChange={(val) => updateTheme({ fontSize: Array.isArray(val) ? val[0] : val })}
            className="w-full"
          />
        </div>

        {/* Design Style Toggle */}
        <div className="space-y-2.5">
          <Label className="text-xs font-medium">Design Style</Label>
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
            <button
              onClick={() => updateTheme({ style: "minimal" })}
              className={`flex-1 py-2 text-xs font-medium transition-all ${
                themeSettings.style === "minimal"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Minimal
            </button>
            <button
              onClick={() => updateTheme({ style: "bold" })}
              className={`flex-1 py-2 text-xs font-medium transition-all ${
                themeSettings.style === "bold"
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                themeSettings.style === "bold"
                  ? { backgroundColor: accent }
                  : undefined
              }
            >
              Bold
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
