"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useDefaultLayout } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

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
import { Button } from "@/components/ui/button";

const SIDE_COLLAPSED_SIZE_PX = 56;
const SLIDES_COLLAPSED_SIZE_PX = 52;

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
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const slidesPanelRef = useRef<PanelImperativeHandle | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [slidesCollapsed, setSlidesCollapsed] = useState(false);

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
    const frame = window.requestAnimationFrame(() => {
      setLeftCollapsed(leftPanelRef.current?.isCollapsed() ?? false);
      setRightCollapsed(rightPanelRef.current?.isCollapsed() ?? false);
      setSlidesCollapsed(slidesPanelRef.current?.isCollapsed() ?? false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [cards.length]);

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
          collapsedSize={`${SIDE_COLLAPSED_SIZE_PX}px`}
          panelRef={leftPanelRef}
          onResize={(size) =>
            setLeftCollapsed(size.inPixels <= SIDE_COLLAPSED_SIZE_PX + 4)
          }
          className="min-w-0 min-h-0"
        >
          {leftCollapsed ? (
            <div className="relative h-full w-full border-r border-border bg-card/85">
              <div className="absolute inset-x-0 top-1.5 bottom-10 flex items-center justify-center overflow-hidden">
                <p className="select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/90 -rotate-90">
                  AI Assistant
                </p>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <Button
                  size="icon-xs"
                  variant="outline"
                  onClick={() => leftPanelRef.current?.expand()}
                  title="Expand AI sidebar"
                  aria-label="Expand AI sidebar"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <LeftSidebar />
          )}
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
                  collapsedSize={`${SLIDES_COLLAPSED_SIZE_PX}px`}
                  panelRef={slidesPanelRef}
                  onResize={(size) =>
                    setSlidesCollapsed(
                      size.inPixels <= SLIDES_COLLAPSED_SIZE_PX + 4,
                    )
                  }
                  className="min-w-0 min-h-0"
                >
                  {slidesCollapsed ? (
                    <div className="h-full w-full border-t border-border bg-card/85 flex items-center justify-center gap-2.5 px-3">
                      <span className="text-[10px] font-medium text-muted-foreground select-none">
                        Slide Manager
                      </span>
                      <Button
                        size="icon-xs"
                        variant="outline"
                        onClick={() => slidesPanelRef.current?.expand()}
                        title="Expand slide manager"
                        aria-label="Expand slide manager"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <SlideManager />
                  )}
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
          collapsedSize={`${SIDE_COLLAPSED_SIZE_PX}px`}
          panelRef={rightPanelRef}
          onResize={(size) =>
            setRightCollapsed(size.inPixels <= SIDE_COLLAPSED_SIZE_PX + 4)
          }
          className="min-w-0 min-h-0"
        >
          {rightCollapsed ? (
            <div className="relative h-full w-full border-l border-border bg-card/85">
              <div className="absolute inset-x-0 top-1.5 bottom-10 flex items-center justify-center overflow-hidden">
                <p className="select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/90 -rotate-90">
                  Style Panel
                </p>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <Button
                  size="icon-xs"
                  variant="outline"
                  onClick={() => rightPanelRef.current?.expand()}
                  title="Expand style sidebar"
                  aria-label="Expand style sidebar"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <RightSidebar />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
