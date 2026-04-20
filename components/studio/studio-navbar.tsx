"use client";

import { useSyncExternalStore } from "react";

import { useStudioStore } from "@/store/useStudioStore";
import { getAccessibleTextColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, Sun, Moon, Save } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useCanvasStore } from "@/store/useCanvasStore";

export function StudioNavbar() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const {
    cards,
    prompt,
    tone,
    platform,
    aspectRatio,
    themeSettings,
    projectId,
    setProjectId,
  } = useStudioStore();
  const { user } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const slidesByCardId = useCanvasStore((s) => s.slidesByCardId);
  const currentSlideId = useCanvasStore((s) => s.currentSlideId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const gridEnabled = useCanvasStore((s) => s.gridEnabled);
  const rulerEnabled = useCanvasStore((s) => s.rulerEnabled);

  const handleSaveProject = async () => {
    if (!user) {
      toast.error("Please sign in to save projects.");
      return;
    }
    if (cards.length === 0) {
      toast.error("Generate some content first.");
      return;
    }

    try {
      const pId = projectId || crypto.randomUUID();
      const projectRef = doc(db, `users/${user.uid}/projects/${pId}`);
      const canvasState = {
        slidesByCardId,
        currentSlideId,
        activeTool,
        gridEnabled,
        rulerEnabled,
      };

      if (!projectId) {
        await setDoc(projectRef, {
          id: pId,
          userId: user.uid,
          prompt,
          platform,
          aspectRatio,
          themeSettings,
          cards,
          canvas: canvasState,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setProjectId(pId);
      } else {
        await setDoc(
          projectRef,
          {
            id: pId,
            userId: user.uid,
            prompt,
            platform,
            aspectRatio,
            themeSettings,
            cards,
            canvas: canvasState,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      toast.success("Project saved securely to cloud!");
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    }
  };

  const handleExportPNG = async () => {
    if (cards.length === 0) {
      toast.error("Generate some content first.");
      return;
    }
    const { exportToPNG } = await import("@/lib/export");
    toast.promise(exportToPNG(), {
      loading: "Preparing PNGs...",
      success: "Exported successfully!",
      error: "Failed to export",
    });
  };

  const handleExportPDF = async () => {
    if (cards.length === 0) {
      toast.error("Generate some content first.");
      return;
    }
    const { exportToPDF } = await import("@/lib/export");
    toast.promise(exportToPDF(), {
      loading: "Preparing PDF document...",
      success: "Exported successfully!",
      error: "Failed to export",
    });
  };

  const accentColor = themeSettings.primaryColor;

  return (
    <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left — Branding */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-md"
          style={{
            backgroundColor: accentColor,
            color: getAccessibleTextColor(accentColor),
          }}
        >
          AI
        </div>
        <span className="font-semibold text-sm tracking-tight text-foreground">
          Postora Studio Editor
        </span>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle — only render icon after mount to avoid hydration mismatch */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : mounted ? (
            <Moon className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4" aria-hidden />
          )}
        </Button>

        {/* Save */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleSaveProject}
        >
          <Save className="w-4 h-4" />
        </Button>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center h-8 px-3 text-xs gap-1.5 shadow-sm rounded-md font-medium transition-colors hover:opacity-90"
            style={{
              backgroundColor: accentColor,
              color: getAccessibleTextColor(accentColor),
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={handleExportPNG}
              className="cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Export as PNG
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportPDF}
              className="cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
