"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStudioStore } from "@/store/useStudioStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Button } from "@/components/ui/button";
import {
  LayoutTemplate,
  Plus,
  Calendar,
  Settings2,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
      // 1. Reset state to baseline to avoid leftover state from previous sessions
      useStudioStore.getState().reset();
      useCanvasStore.getState().reset();

      const preferredSlideId =
        projectData.canvas?.currentSlideId ??
        projectData.cards?.[0]?.id ??
        null;

      // 2. Apply all project data in a single atomic update to prevent sync race conditions
      useStudioStore.setState((state) => ({
        ...state,
        projectId: projectData.id,
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

  const startNewProject = useCallback(() => {
    useStudioStore.getState().reset();
    useCanvasStore.getState().reset();
    useStudioStore.getState().setProjectId(crypto.randomUUID());
    router.push("/studio");
  }, [router]);

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

    if (user) {
      fetchProjects();
    }
  }, [user, loading, router]);

  if (loading || fetching) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
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
            onClick={startNewProject}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 dark:bg-zinc-800 mx-auto rounded-full flex items-center justify-center mb-4">
              <LayoutTemplate className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first carousel or post to see it here.
            </p>
            <Button onClick={startNewProject}>Create Now</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <div key={p.id} className="relative group">
                <button
                  onClick={() => loadProjectToStudio(p)}
                  disabled={deletingId === p.id}
                  className="w-full text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-gray-100 dark:bg-zinc-800 text-xs px-2 py-1 rounded-md font-medium text-gray-700 dark:text-gray-300">
                      {p.platform}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {p.updatedAt?.toDate
                        ? format(p.updatedAt.toDate(), "MMM d, yyyy")
                        : "Recently"}
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                    {p.prompt || "Untitled Project"}
                  </h3>

                  <div className="mt-6 flex items-center text-sm text-gray-500">
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    {p.cards?.length || 0} cards • Aspect: {p.aspectRatio}
                  </div>
                </button>

                <div className="absolute bottom-6 right-6 z-10 flex items-center gap-1">
                  {deletingId === p.id ? (
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-1.5 rounded-full border border-border/50">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-40 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(p);
                        setIsDeleteModalOpen(true);
                      }}
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Delete Project?</DialogTitle>
              <DialogDescription className="py-2">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  &quot;{projectToDelete?.prompt}&quot;
                </span>
                ?
                <br />
                <br />
                This will permanently remove the project and all{" "}
                <span className="text-destructive font-medium">
                  associated AI-generated images
                </span>{" "}
                from our storage. This action cannot be undone.
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
    </div>
  );
}
