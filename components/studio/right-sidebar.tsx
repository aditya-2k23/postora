"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { getAccessibleTextColor } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Plus } from "lucide-react";

const DEFAULT_COLORS = ["#8B5CF6", "#10B981", "#1F2937", "#FFFFFF"];

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

        {/* Brand Colors */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Brand Colors</Label>
            <span className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase border border-border px-2 py-0.5 rounded-full">Custom Theme</span>
          </div>
          <div className="flex items-center gap-3">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateTheme({ primaryColor: color })}
                className={`w-9 h-9 rounded-full ${color === "#FFFFFF" ? "border border-border" : ""} transition-all flex items-center justify-center`}
                style={
                  accent.toLowerCase() === color.toLowerCase()
                    ? { outline: `2px solid ${color}`, outlineOffset: "2px", backgroundColor: color }
                    : { backgroundColor: color }
                }
              />
            ))}
            {/* Custom Color Picker Button */}
            <button
              onClick={() => {
                const input = document.getElementById("studio-color-input");
                if (input) (input as HTMLInputElement).click();
              }}
              className="w-9 h-9 rounded-full border border-border bg-card/50 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
            <input
              id="studio-color-input"
              type="color"
              value={accent}
              onChange={(e) => updateTheme({ primaryColor: e.target.value })}
              className="sr-only"
            />
          </div>
        </div>

        {/* Base Font Size */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Base Font Size</Label>
            <span className="text-xs font-bold text-foreground">
              {themeSettings.fontSize}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">A</span>
            <Slider
              value={[themeSettings.fontSize]}
              min={12}
              max={32}
              step={1}
              onValueChange={(val) => updateTheme({ fontSize: Array.isArray(val) ? val[0] : val })}
              className="flex-1"
            />
            <span className="text-lg font-semibold text-muted-foreground">A</span>
          </div>
        </div>

        {/* Design Style Toggle */}
        <div className="space-y-4">
          <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Design Style</Label>
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30 p-1 gap-1">
            <button
              onClick={() => updateTheme({ style: "minimal" })}
              className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase transition-all rounded ${
                themeSettings.style === "minimal"
                  ? "bg-card text-foreground shadow-sm flex items-center justify-center gap-1.5"
                  : "text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
              }`}
            >
              {themeSettings.style === "minimal" && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />}
              Minimal
            </button>
            <button
              onClick={() => updateTheme({ style: "bold" })}
              className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase transition-all rounded ${
                themeSettings.style === "bold"
                  ? "bg-card shadow-sm flex items-center justify-center gap-1.5"
                  : "text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
              }`}
              style={
                themeSettings.style === "bold"
                  ? { backgroundColor: accent, color: getAccessibleTextColor(accent) }
                  : undefined
              }
            >
              {themeSettings.style === "bold" && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />}
              Bold
            </button>
          </div>
        </div>

        {/* Layout Engine */}
        <div className="space-y-4">
          <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Layout Engine</Label>
          <div className="grid grid-cols-3 gap-3">
            {/* Standard Layout */}
            <button
              onClick={() => updateTheme({ layoutEngine: "standard" })}
              className={`flex flex-col gap-1.5 p-2 rounded-lg border-2 transition-all ${
                themeSettings.layoutEngine === "standard" ? "border-transparent" : "border-border hover:border-muted-foreground/50"
              }`}
              style={themeSettings.layoutEngine === "standard" ? { borderColor: accent } : undefined}
            >
              <div className="w-full h-4 rounded-sm bg-muted-foreground/40" />
              <div className="w-full flex-1 rounded-sm bg-muted-foreground/20" />
            </button>

            {/* Inverted / Bottom Text */}
            <button
              onClick={() => updateTheme({ layoutEngine: "inverted" })}
              className={`flex flex-col gap-1.5 p-2 rounded-lg border-2 transition-all h-20 ${
                themeSettings.layoutEngine === "inverted" ? "border-transparent" : "border-border hover:border-muted-foreground/50"
              }`}
              style={themeSettings.layoutEngine === "inverted" ? { borderColor: accent } : undefined}
            >
              <div className="w-full flex-1 rounded-sm bg-muted-foreground/20" />
              <div className="w-full h-4 rounded-sm bg-muted-foreground/40" />
            </button>

            {/* Split Layout */}
            <button
              onClick={() => updateTheme({ layoutEngine: "split" })}
              className={`flex gap-1.5 p-2 rounded-lg border-2 transition-all h-20 ${
                themeSettings.layoutEngine === "split" ? "border-transparent" : "border-border hover:border-muted-foreground/50"
              }`}
              style={themeSettings.layoutEngine === "split" ? { borderColor: accent } : undefined}
            >
              <div className="w-full flex-1 rounded-sm bg-muted-foreground/40" />
              <div className="w-full flex-1 rounded-sm bg-muted-foreground/20" />
            </button>
          </div>
        </div>

        {/* Padding */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border border-muted-foreground rounded-sm flex items-center justify-center text-[8px] font-bold text-muted-foreground">P</div>
              <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Padding</Label>
            </div>
            <span className="text-xs font-bold" style={{ color: accent }}>
              {themeSettings.padding}px
            </span>
          </div>
          <Slider
            value={[themeSettings.padding]}
            min={0}
            max={80}
            step={4}
            onValueChange={(val) => updateTheme({ padding: Array.isArray(val) ? val[0] : val })}
          />
        </div>

        {/* Roundness */}
        <div className="space-y-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border border-muted-foreground rounded-sm rounded-tl-xl text-[8px] font-bold text-muted-foreground" />
              <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Roundness</Label>
            </div>
            <span className="text-xs font-bold" style={{ color: accent }}>
              {themeSettings.roundness}px
            </span>
          </div>
          <Slider
            value={[themeSettings.roundness]}
            min={0}
            max={48}
            step={2}
            onValueChange={(val) => updateTheme({ roundness: Array.isArray(val) ? val[0] : val })}
          />
        </div>
      </div>
    </div>
  );
}
