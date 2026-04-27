"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { collection, query, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStudioStore } from "@/store/useStudioStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { ALLOWED_ASPECT_RATIOS, ASPECT_RATIO_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  LayoutTemplate,
  Plus,
  Settings2,
  Trash2,
  Loader2,
  Pencil,
  Check,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Constants ───────────────────────────────────────────────────────────────
const TONES = [
  "Professional",
  "Friendly",
  "Bold",
  "Parent-Focused",
  "Humorous",
  "Educational",
];
const PLATFORMS = [
  "Instagram Carousel",
  "Instagram Post",
  "Instagram Story",
  "LinkedIn Post",
  "X/Twitter Graphic",
  "TikTok Cover",
];

// ─── Relative timestamp helper ────────────────────────────────────────────────
function RelativeTime({ date }: { date: Date | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!date || !mounted)
    return <span className="text-xs text-gray-400">—</span>;

  const daysDiff = differenceInDays(new Date(), date);
  let label: string;

  if (daysDiff < 1) {
    label = formatDistanceToNow(date, { addSuffix: true });
  } else if (daysDiff < 30) {
    label = formatDistanceToNow(date, { addSuffix: true });
  } else {
    label = format(date, "MMM d, yyyy");
  }

  return (
    <span
      title={format(date, "PPpp")}
      className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0"
    >
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── New Project setup modal ──────────────────────────────────────────────────
interface NewProjectConfig {
  platform: string;
  aspectRatio: string;
  tone: string;
  numCards: number;
}

function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (cfg: NewProjectConfig) => void;
}) {
  const [platform, setPlatform] = useState("Instagram Carousel");
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [tone, setTone] = useState("Professional");
  const [numCards, setNumCards] = useState(5);

  // Sync default aspect ratio when platform changes
  useEffect(() => {
    const defaults: Record<string, string> = {
      "Instagram Carousel": "4:5",
      "Instagram Post": "1:1",
      "Instagram Story": "9:16",
      "LinkedIn Post": "1:1",
      "X/Twitter Graphic": "16:9",
      "TikTok Cover": "9:16",
    };
    if (defaults[platform]) setAspectRatio(defaults[platform]);
  }, [platform]);

  const handleCreate = () => {
    onCreate({ platform, aspectRatio, tone, numCards });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow">
              AI
            </div>
            New Project
          </DialogTitle>
          <DialogDescription>
            Choose your target platform and style. These settings shape how your
            content is generated and laid out.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Platform */}
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Platform
            </Label>
            <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Aspect Ratio
            </Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => v && setAspectRatio(v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ASPECT_RATIO_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tone
            </Label>
            <Select value={tone} onValueChange={(v) => v && setTone(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Num Cards */}
          <div className="space-y-2 col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Number of Slides
              </Label>
              <span className="text-sm font-bold tabular-nums text-foreground bg-muted px-2 py-0.5 rounded">
                {numCards}
              </span>
            </div>
            <Slider
              value={[numCards]}
              min={1}
              max={12}
              step={1}
              onValueChange={(v) => setNumCards(Array.isArray(v) ? v[0] : v)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1</span>
              <span>12</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Single project card ──────────────────────────────────────────────────────
function ProjectCard({
  p,
  onOpen,
  onRename,
  onDeleteRequest,
  isDeleting,
}: {
  p: any;
  onOpen: () => void;
  onRename: (name: string) => Promise<void>;
  onDeleteRequest: () => void;
  isDeleting: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName =
    p.projectName ||
    (p.prompt
      ? p.prompt.slice(0, 48) + (p.prompt.length > 48 ? "…" : "")
      : "Untitled Project");

  const updatedDate: Date | null = p.updatedAt?.toDate
    ? p.updatedAt.toDate()
    : null;

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(p.projectName || "");
    setIsRenaming(true);
  };

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const commit = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (trimmed !== (p.projectName || "")) await onRename(trimmed);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") cancel();
  };

  return (
    <div className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all overflow-hidden h-full">
      {/* ── Action Buttons (Top Right Overlay) ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
        <RelativeTime date={updatedDate} />
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteRequest();
            }}
            title="Delete project"
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground opacity-50 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-border/50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={!isRenaming ? onOpen : undefined}
        onKeyDown={(e) => {
          if (!isRenaming && (e.key === "Enter" || e.key === " ")) onOpen();
        }}
        className={`flex-1 flex flex-col p-6 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Row 1: platform badge */}
        <div className="flex items-start mb-4">
          <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold border border-blue-100 dark:border-blue-800/30">
            {p.platform || "GENERAL"}
          </span>
        </div>

        {/* Row 2: title + rename */}
        {isRenaming ? (
          <div
            className="flex items-center gap-1.5 mb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => commit()}
              maxLength={60}
              placeholder="Project name…"
              className="flex-1 min-w-0 h-9 px-3 text-sm font-semibold bg-background border border-primary/50 rounded-md outline-none ring-2 ring-primary/20 text-foreground placeholder:text-muted-foreground/50 shadow-inner"
            />
            <button
              onMouseDown={(e) => commit(e)}
              className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors border border-emerald-500/20"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <h3 className="flex flex-1 items-center gap-1 font-bold text-lg leading-tight text-foreground line-clamp-2 group/title">
            {displayName}
            <button
              onClick={startRename}
              title="Rename project"
              className="h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground opacity-30 group-hover/title:opacity-100 transition-all"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </h3>
        )}

        {/* Row 3: meta */}
        <div className="mt-auto pt-4 flex items-center text-[11px] font-medium text-muted-foreground gap-2 border-t border-gray-50 dark:border-zinc-800/50">
          <div className="flex items-center gap-1">
            <Settings2 className="w-3 h-3" />
            <span>{p.cards?.length || 0} Slides</span>
          </div>
          <span className="opacity-30">•</span>
          <span>{p.aspectRatio || "—"}</span>
          {p.tone && (
            <>
              <span className="opacity-30">•</span>
              <span className="capitalize">{p.tone}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const setProjectId = useStudioStore((s) => s.setProjectId);
  const setPrompt = useStudioStore((s) => s.setPrompt);
  const setTone = useStudioStore((s) => s.setTone);
  const setPlatform = useStudioStore((s) => s.setPlatform);
  const setAspectRatio = useStudioStore((s) => s.setAspectRatio);
  const setNumCards = useStudioStore((s) => s.setNumCards);
  const updateTheme = useStudioStore((s) => s.updateTheme);
  const setCards = useStudioStore((s) => s.setCards);
  const setActiveCardId = useStudioStore((s) => s.setActiveCardId);

  const loadProjectToStudio = useCallback(
    (projectData: any) => {
      useStudioStore.getState().reset();
      useCanvasStore.getState().reset();

      const preferredSlideId =
        projectData.canvas?.currentSlideId ??
        projectData.cards?.[0]?.id ??
        null;

      useStudioStore.setState((state) => ({
        ...state,
        projectId: projectData.id,
        projectName: projectData.projectName || null,
        prompt: projectData.prompt || "",
        tone: projectData.tone || "Professional",
        platform: projectData.platform || "Instagram Carousel",
        aspectRatio: projectData.aspectRatio || "4:5",
        numCards: projectData.numCards || projectData.cards?.length || 5,
        themeSettings: projectData.themeSettings || state.themeSettings,
        cards: projectData.cards || [],
        chatHistory: projectData.chatHistory || [],
        assistantHistory: projectData.assistantHistory || [],
        activeCardId: preferredSlideId,
      }));

      const canvas = projectData.canvas;
      useCanvasStore.setState((state) => ({
        ...state,
        slidesByCardId: canvas?.slidesByCardId ?? {},
        currentSlideId: preferredSlideId,
        activeTool: (canvas?.activeTool as any) ?? "select",
        gridEnabled: !!canvas?.gridEnabled,
        rulerEnabled: !!canvas?.rulerEnabled,
      }));

      router.push("/studio");
    },
    [
      router,
      setActiveCardId,
      setAspectRatio,
      setCards,
      setNumCards,
      setPlatform,
      setProjectId,
      setPrompt,
      setTone,
      updateTheme,
    ],
  );

  // Called when the user confirms the new-project setup modal
  const startNewProject = useCallback(
    (cfg: NewProjectConfig) => {
      useStudioStore.getState().reset();
      useCanvasStore.getState().reset();
      useStudioStore.setState((state) => ({
        ...state,
        projectId: crypto.randomUUID(),
        platform: cfg.platform,
        aspectRatio: cfg.aspectRatio,
        tone: cfg.tone,
        numCards: cfg.numCards,
      }));
      router.push("/studio");
    },
    [router],
  );

  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!user) return;
    try {
      const projectRef = doc(db, `users/${user.uid}/projects/${projectId}`);
      await updateDoc(projectRef, { projectName: newName || null });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, projectName: newName || null } : p,
        ),
      );
      toast.success(
        newName ? `Renamed to "${newName}"` : "Project name cleared",
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to rename: " + (err.message || "Unknown error"));
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    const projectId = projectToDelete.id;
    setIsDeleteModalOpen(false);
    setDeletingId(projectId);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete project");
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, `users/${user.uid}/projects`));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as any);
        data.sort(
          (a, b) =>
            (b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0) -
            (a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0),
        );
        setProjects(data);
      } catch (e) {
        console.error(e);
      } finally {
        setFetching(false);
      }
    };

    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (user) fetchProjects();
  }, [user, loading, router]);

  if (loading || fetching) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Recent Projects
            </h1>
            <p className="text-gray-500 mt-2">
              Manage all your generated social media content in one place.
            </p>
          </div>
          <Button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </div>

        {/* Grid */}
        {projects.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 dark:bg-zinc-800 mx-auto rounded-full flex items-center justify-center mb-4">
              <LayoutTemplate className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first carousel or post to see it here.
            </p>
            <Button onClick={() => setIsNewProjectModalOpen(true)}>
              Create Now
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                onOpen={() => loadProjectToStudio(p)}
                onRename={(name) => handleRenameProject(p.id, name)}
                onDeleteRequest={() => {
                  setProjectToDelete(p);
                  setIsDeleteModalOpen(true);
                }}
                isDeleting={deletingId === p.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Project modal */}
      <NewProjectModal
        open={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreate={startNewProject}
      />

      {/* Delete confirmation */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Delete Project?</DialogTitle>
            <DialogDescription className="py-2">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                &quot;
                {projectToDelete?.projectName ||
                  projectToDelete?.prompt?.slice(0, 40) ||
                  "this project"}
                &quot;
              </span>
              ?
              <br />
              <br />
              This will permanently remove the project and all{" "}
              <span className="text-destructive font-medium">
                associated AI-generated images
              </span>{" "}
              from storage. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              className="font-medium"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              className="font-bold shadow-lg shadow-destructive/5"
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
