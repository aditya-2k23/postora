"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStudioStore } from "@/store/useStudioStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Plus, Calendar, Settings2 } from "lucide-react";
import { format } from "date-fns";

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

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

      // 2. Apply project data
      setProjectId(projectData.id);
      setPrompt(projectData.prompt || "");
      setTone(projectData.tone || "Professional");
      setPlatform(projectData.platform || "Instagram Carousel");
      setAspectRatio(projectData.aspectRatio || "4:5");
      setNumCards(projectData.numCards || projectData.cards?.length || 5);

      if (projectData.themeSettings) {
        updateTheme(projectData.themeSettings);
      }

      if (projectData.cards) {
        setCards(projectData.cards);
      }

      const preferredSlideId =
        projectData.canvas?.currentSlideId ??
        projectData.cards?.[0]?.id ??
        null;

      if (preferredSlideId) {
        setActiveCardId(preferredSlideId);
      }

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
    router.push("/studio");
  }, [router]);

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
            <Button
              onClick={startNewProject}
            >
              Create Now
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => loadProjectToStudio(p)}
                className="group w-full text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all cursor-pointer relative overflow-hidden"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
