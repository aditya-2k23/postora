"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useDefaultLayout } from "react-resizable-panels";

import { useAuth } from "@/components/auth-provider";
import { useStudioStore } from "@/store/useStudioStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { StudioNavbar } from "@/components/studio/studio-navbar";
import { LeftSidebar } from "@/components/studio/left-sidebar";
import { CenterCanvas } from "@/components/studio/center-canvas";
import { RightSidebar } from "@/components/studio/right-sidebar";
import { SlideManager } from "@/components/studio/slide-manager";
import { db } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function StudioPage() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { user } = useAuth();
  const primaryColor = useStudioStore((s) => s.themeSettings.primaryColor);
  const projectId = useStudioStore((s) => s.projectId);
  const prompt = useStudioStore((s) => s.prompt);
  const platform = useStudioStore((s) => s.platform);
  const tone = useStudioStore((s) => s.tone);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const themeSettings = useStudioStore((s) => s.themeSettings);
  const cards = useStudioStore((s) => s.cards);
  const canvasSlides = useCanvasStore((s) => s.slidesByCardId);
  const canvasCurrentSlideId = useCanvasStore((s) => s.currentSlideId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const gridEnabled = useCanvasStore((s) => s.gridEnabled);
  const rulerEnabled = useCanvasStore((s) => s.rulerEnabled);

  const centerPanelIds = useMemo(
    () =>
      cards.length > 0 ? ["studio-canvas", "studio-slides"] : ["studio-canvas"],
    [cards.length],
  );

  const panelLayoutStorage = useMemo(
    () =>
      typeof window === "undefined"
        ? {
            getItem: () => null,
            setItem: () => {},
          }
        : window.localStorage,
    [],
  );

  const mainLayoutPersistence = useDefaultLayout({
    id: "studio-main-split-v2",
    panelIds: ["studio-left", "studio-center", "studio-right"],
    storage: panelLayoutStorage,
  });

  const centerLayoutPersistence = useDefaultLayout({
    id: "studio-center-split-v2",
    panelIds: centerPanelIds,
    storage: panelLayoutStorage,
  });

  useEffect(() => {
    if (!mounted || !user || !projectId || cards.length === 0) return;
    const timer = window.setTimeout(async () => {
      try {
        const projectRef = doc(db, `users/${user.uid}/projects/${projectId}`);
        await setDoc(
          projectRef,
          {
            id: projectId,
            userId: user.uid,
            prompt,
            platform,
            tone,
            aspectRatio,
            themeSettings,
            cards,
            canvas: {
              slidesByCardId: canvasSlides,
              currentSlideId: canvasCurrentSlideId,
              activeTool,
              gridEnabled,
              rulerEnabled,
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Auto-sync failed:", error);
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    aspectRatio,
    canvasCurrentSlideId,
    canvasSlides,
    activeTool,
    cards,
    gridEnabled,
    platform,
    projectId,
    prompt,
    rulerEnabled,
    themeSettings,
    tone,
    user,
    mounted,
  ]);

  if (!mounted) {
    return <div className="h-screen bg-background" />;
  }

  return (
    <div
      className="studio-accent-scope flex flex-col h-screen bg-background text-foreground overflow-hidden"
      style={{ "--studio-accent": primaryColor } as React.CSSProperties}
    >
      {/* Top Navbar */}
      <StudioNavbar />

      {/* Main Body */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1 w-full h-full"
        defaultLayout={mainLayoutPersistence.defaultLayout}
        onLayoutChanged={mainLayoutPersistence.onLayoutChanged}
      >
        {/* Left — AI Assistant */}
        <ResizablePanel
          id="studio-left"
          defaultSize="25%"
          minSize="15%"
          maxSize="40%"
          collapsible={true}
          className="min-w-0 min-h-0"
        >
          <LeftSidebar />
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="hover:bg-primary transition-colors focus:bg-primary"
        />

        {/* Center Canvas & Slide Manager */}
        <ResizablePanel
          id="studio-center"
          defaultSize="50%"
          minSize="20%"
          className="min-w-0 min-h-0"
        >
          <ResizablePanelGroup
            orientation="vertical"
            className="w-full h-full"
            defaultLayout={centerLayoutPersistence.defaultLayout}
            onLayoutChanged={centerLayoutPersistence.onLayoutChanged}
          >
            <ResizablePanel
              id="studio-canvas"
              defaultSize={cards.length > 0 ? "70%" : "100%"}
              minSize="30%"
              collapsible={true}
              className="min-w-0 min-h-0"
            >
              <CenterCanvas />
            </ResizablePanel>

            {cards.length > 0 && (
              <>
                <ResizableHandle
                  withHandle
                  className="hover:bg-primary transition-colors focus:bg-primary"
                />

                <ResizablePanel
                  id="studio-slides"
                  defaultSize="30%"
                  minSize="15%"
                  maxSize="50%"
                  collapsible={true}
                  className="min-w-0 min-h-0"
                >
                  <SlideManager />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="hover:bg-primary transition-colors focus:bg-primary"
        />

        {/* Right — Appearance */}
        <ResizablePanel
          id="studio-right"
          defaultSize="25%"
          minSize="15%"
          maxSize="40%"
          collapsible={true}
          className="min-w-0 min-h-0"
        >
          <RightSidebar />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
