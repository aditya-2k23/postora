"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from "react";

import { useStudioStore } from "@/store/useStudioStore";
import { useShallow } from "zustand/shallow";
import { getAccessibleTextColor, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  ChevronDown,
  Sun,
  Moon,
  Save,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { db, signOut } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useRouter } from "next/navigation";

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
    numCards,
    themeSettings,
    projectId,
    projectName,
    setProjectId,
    setProjectName,
    chatHistory,
    assistantHistory,
    studioVersion,
  } = useStudioStore(
    useShallow((s) => ({
      cards: s.cards,
      prompt: s.prompt,
      tone: s.tone,
      platform: s.platform,
      aspectRatio: s.aspectRatio,
      numCards: s.numCards,
      themeSettings: s.themeSettings,
      projectId: s.projectId,
      projectName: s.projectName,
      setProjectId: s.setProjectId,
      setProjectName: s.setProjectName,
      chatHistory: s.chatHistory,
      assistantHistory: s.assistantHistory,
      studioVersion: s.studioVersion,
    })),
  );
  const { user } = useAuth();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const slidesByCardId = useCanvasStore((s) => s.slidesByCardId);
  const currentSlideId = useCanvasStore((s) => s.currentSlideId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const gridEnabled = useCanvasStore((s) => s.gridEnabled);
  const rulerEnabled = useCanvasStore((s) => s.rulerEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<{
    studioVersion: number;
  }>({
    studioVersion,
  });

  // ── Inline rename state ──
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback(() => {
    setRenameValue(projectName || "");
    setIsRenaming(true);
  }, [projectName]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    setProjectName(trimmed || null);
    setIsRenaming(false);
    if (trimmed) {
      toast.success("Project renamed!");
    }
  }, [renameValue, setProjectName]);

  const cancelRename = useCallback(() => {
    setIsRenaming(false);
  }, []);

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      cancelRename();
    }
  };

  // ── Dirty-state tracking ──
  const lastSnapshotProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (projectId) {
      if (
        lastSnapshotProjectRef.current !== projectId &&
        (assistantHistory.length > 0 || chatHistory.length > 0)
      ) {
        setLastSavedState({ studioVersion });
        lastSnapshotProjectRef.current = projectId;
      }
    } else {
      lastSnapshotProjectRef.current = null;
    }
  }, [projectId, assistantHistory.length, chatHistory.length, studioVersion]);

  const isDirty = !projectId || studioVersion !== lastSavedState.studioVersion;
  const showUnsavedIndicator =
    isDirty &&
    !isSaving &&
    (assistantHistory.length >= 2 || chatHistory.length >= 4);

  const handleSaveProject = async () => {
    if (isSaving) return;
    if (!user) {
      toast.error("Please log in to save projects.");
      router.push("/login");
      return;
    }

    const hasContent =
      cards.length > 0 ||
      prompt ||
      chatHistory.length > 0 ||
      assistantHistory.length > 0;

    if (!hasContent) {
      toast.error("Nothing to save yet.");
      return;
    }

    setIsSaving(true);
    try {
      const pId = projectId || crypto.randomUUID();
      const projectRef = doc(db, `users/${user.uid}/projects/${pId}`);

      const canvasPayload = {
        slidesByCardId,
        ...(currentSlideId ? { currentSlideId } : {}),
        activeTool,
        gridEnabled,
        rulerEnabled,
        updatedAt: serverTimestamp(),
      };

      const mainPayload = {
        id: pId,
        userId: user.uid,
        ...(projectName ? { projectName } : {}),
        prompt,
        tone,
        platform,
        aspectRatio,
        numCards,
        themeSettings,
        cards,
        chatHistory,
        assistantHistory,
        canvas: canvasPayload,
        updatedAt: serverTimestamp(),
        ...(projectId ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(projectRef, mainPayload, { merge: true });

      if (!projectId) {
        setProjectId(pId);
      }

      setLastSavedState({ studioVersion });
      toast.success("Project saved securely to cloud!");
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setIsSaving(false);
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
      error: (e: any) => `Failed to export: ${e.message || "Unknown error"}`,
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
      error: (e: any) => {
        const msg = e?.message?.toLowerCase() || "";
        if (msg.includes("permission")) {
          return "PDF Generated. Ignore background sync error.";
        }
        return `Failed to export: ${e.message || "Unknown error"}`;
      },
    });
  };

  const accentColor = themeSettings.primaryColor;

  // Derive the display title — fallback hierarchy: name → truncated prompt → "Untitled Project"
  const displayTitle =
    projectName ||
    (prompt ? prompt.slice(0, 32) + (prompt.length > 32 ? "…" : "") : null) ||
    "Untitled Project";

  return (
    <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left — Branding + Project title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-sm shadow-md"
          style={{
            backgroundColor: accentColor,
            color: getAccessibleTextColor(accentColor),
          }}
        >
          AI
        </div>

        {/* Project title — inline editable */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={commitRename}
                maxLength={60}
                placeholder="Project name…"
                className="h-7 w-48 max-w-[200px] px-2 py-0.5 text-sm font-semibold bg-background border border-primary/50 rounded-md outline-none ring-2 ring-primary/20 text-foreground placeholder:text-muted-foreground/50"
              />
              <button
                onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
                className="h-6 w-6 flex items-center justify-center rounded text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                title="Confirm rename"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
                title="Cancel rename"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={startRename}
              title="Click to rename project"
              className="group flex items-center gap-1.5 min-w-0 max-w-[200px] px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
            >
              <span className="font-semibold text-sm tracking-tight text-foreground truncate">
                {displayTitle}
              </span>
              <Pencil className="w-3 h-3 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
            </button>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all duration-200 flex-shrink-0"
          onClick={async () => {
            if (user && (cards.length > 0 || prompt)) {
              handleSaveProject().catch(() => {});
            }
            router.push("/projects");
          }}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-xs font-semibold">Go to Projects</span>
        </Button>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            resolvedTheme === "dark"
              ? "Switch to light theme"
              : "Switch to dark theme"
          }
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
        <div className="relative flex items-center">
          {showUnsavedIndicator && (
            <span className="absolute top-[calc(100%+4px)] right-[-30px] whitespace-nowrap text-[9px] font-medium text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded shadow-sm animate-in fade-in slide-in-from-top-1">
              {projectId ? "Unsaved changes" : "Save to keep history"}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Save project"
            className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
            onClick={handleSaveProject}
            disabled={isSaving}
          >
            <Save className={cn("w-4 h-4", isSaving && "animate-pulse")} />
            {showUnsavedIndicator && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-card" />
            )}
          </Button>
        </div>

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
            <DropdownMenuItem onClick={handleExportPNG} className="cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-2" />
              Export as PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Auth Buttons */}
        {mounted && user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              toast.success("Successfully logged out.");
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        ) : mounted ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/login")}
            className="flex items-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Log in</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
