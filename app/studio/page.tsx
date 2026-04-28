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
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";

const SIDE_COLLAPSED_SIZE_PX = 56;

/**
 * Recursively removes all `undefined` values from an object so that
 * Firestore (which rejects `undefined` fields) never receives them.
 */
function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirestore) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        result[k] = sanitizeForFirestore(v);
      }
    }
    return result as T;
  }
  return value;
}
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
  const projectName = useStudioStore((s) => s.projectName);
  const prompt = useStudioStore((s) => s.prompt);
  const platform = useStudioStore((s) => s.platform);
  const tone = useStudioStore((s) => s.tone);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const numCards = useStudioStore((s) => s.numCards);
  const themeSettings = useStudioStore((s) => s.themeSettings);
  const cards = useStudioStore((s) => s.cards);
  const chatHistory = useStudioStore((s) => s.chatHistory);
  const assistantHistory = useStudioStore((s) => s.assistantHistory);
  const canvasSlides = useCanvasStore((s) => s.slidesByCardId);
  const canvasCurrentSlideId = useCanvasStore((s) => s.currentSlideId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const gridEnabled = useCanvasStore((s) => s.gridEnabled);
  const rulerEnabled = useCanvasStore((s) => s.rulerEnabled);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const slidesPanelRef = useRef<PanelImperativeHandle | null>(null);
  const lastReconciledProjectIdRef = useRef<string | null>(null);
  const migrationInFlightRef = useRef(false);
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
    if (
      !mounted ||
      !user ||
      !projectId ||
      cards.length === 0 ||
      lastReconciledProjectIdRef.current === projectId ||
      migrationInFlightRef.current
    )
      return;

    let needsMigration = false;
    for (const card of cards) {
      if (card.imageUrl && card.imageUrl.startsWith("data:image/")) {
        needsMigration = true;
      }
    }

    if (!needsMigration) {
      lastReconciledProjectIdRef.current = projectId;
      return;
    }

    const backfillImages = async () => {
      try {
        // Lazy migration for legacy base64 images.
        if (needsMigration) {
          const token = await user.getIdToken();
          for (const card of cards) {
            if (card.imageUrl && card.imageUrl.startsWith("data:image/")) {
              try {
                const res = await fetch("/api/migrate-image", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    imageBase64: card.imageUrl,
                    projectId,
                    cardId: card.id,
                  }),
                });

                if (res.ok) {
                  const data = await res.json();
                  if (data.imageUrl) {
                    useStudioStore
                      .getState()
                      .updateCard(card.id, { imageUrl: data.imageUrl });
                    useCanvasStore
                      .getState()
                      .syncCardImage(card.id, data.imageUrl);
                  }
                }
              } catch (e) {
                console.error("Migration failed for card", card.id, e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to reconcile/migrate images:", error);
      } finally {
        migrationInFlightRef.current = false;
        lastReconciledProjectIdRef.current = projectId;
      }
    };

    migrationInFlightRef.current = true;
    backfillImages();
  }, [mounted, user, projectId, cards]);

  const lastCardsSyncedRef = useRef<string>("");
  const lastCanvasSyncedRef = useRef<string>("");
  const hasLoadedProjectRef = useRef<string | null>(null);

  // Capture canvasCurrentSlideId in a ref so the load effect can read the
  // latest value without making it a reactive dependency (which caused the
  // effect to re-run every time the active slide changed).
  const canvasCurrentSlideIdRef = useRef(canvasCurrentSlideId);
  useEffect(() => {
    canvasCurrentSlideIdRef.current = canvasCurrentSlideId;
  }, [canvasCurrentSlideId]);

  // Auto-create project for signed-in users returning with local anonymous data
  useEffect(() => {
    if (!mounted || !user || projectId || migrationInFlightRef.current) return;

    const isPristine =
      prompt === "" &&
      (cards.length === 0 ||
        (cards.length === 1 &&
          cards[0].id === "default-slide-1" &&
          !cards[0].imageUrl &&
          cards[0].title === "Slide 1" &&
          cards[0].content === "Add your text here..." &&
          (canvasSlides[cards[0].id]?.elements?.length ?? 0) <= 2));

    if (!isPristine) {
      const newProjectId = crypto.randomUUID();
      useStudioStore.getState().setProjectId(newProjectId);
      // The Sync effects will catch this new projectId and save it automatically.
    }
  }, [mounted, user, projectId, cards, canvasSlides]);

  // Ensure at least one slide exists for new or empty projects
  useEffect(() => {
    if (!mounted || cards.length > 0) return;

    // If we're not loading a project from Firestore, and we have 0 cards, create a default one.
    if (!user || !projectId || hasLoadedProjectRef.current === projectId) {
      const firstCardId = "default-slide-1";
      useStudioStore.setState((state) => ({
        ...state,
        cards: [
          {
            id: firstCardId,
            title: "Slide 1",
            content: "Add your text here...",
          },
        ],
        activeCardId: firstCardId,
      }));
      useCanvasStore.setState((state) => ({
        ...state,
        currentSlideId: firstCardId,
      }));
    }
  }, [mounted, cards.length, user, projectId]);

  // Initial project & canvas load for existing projects
  useEffect(() => {
    if (
      !mounted ||
      !user ||
      !projectId ||
      hasLoadedProjectRef.current === projectId
    )
      return;

    const loadProjectData = async () => {
      try {
        const projectDocRef = doc(
          db,
          `users/${user.uid}/projects/${projectId}`,
        );
        const projectSnap = await getDoc(projectDocRef);
        if (!projectSnap.exists()) {
          hasLoadedProjectRef.current = projectId;
          return;
        }

        const data = projectSnap.data();

        // 1. Populate Studio Store
        const studio = useStudioStore.getState();
        studio.setProjectName(data.projectName || "");
        if (data.prompt !== undefined) studio.setPrompt(data.prompt);
        if (data.tone !== undefined) studio.setTone(data.tone);
        if (data.platform !== undefined) studio.setPlatform(data.platform);
        if (data.aspectRatio !== undefined)
          studio.setAspectRatio(data.aspectRatio);
        if (data.numCards !== undefined) studio.setNumCards(data.numCards);
        if (data.themeSettings) studio.updateTheme(data.themeSettings);
        if (data.cards) studio.setCards(data.cards);
        if (data.chatHistory) studio.setChatHistory(data.chatHistory);
        if (data.assistantHistory)
          studio.setAssistantHistory(data.assistantHistory);

        // Track last synced to avoid immediate re-save
        lastCardsSyncedRef.current = JSON.stringify({
          projectName: data.projectName || null,
          prompt: data.prompt || "",
          platform: data.platform || "",
          tone: data.tone || "",
          aspectRatio: data.aspectRatio || "",
          numCards: data.numCards || 5,
          themeSettings: data.themeSettings || studio.themeSettings,
          cards: data.cards || [],
          chatHistory: data.chatHistory || [],
          assistantHistory: data.assistantHistory || [],
        });

        // 2. Populate Canvas Store
        const canvas = data.canvas;
        if (canvas && typeof canvas === "object") {
          useCanvasStore.setState({
            slidesByCardId: canvas.slidesByCardId || {},
            currentSlideId: canvas.currentSlideId || canvasCurrentSlideIdRef.current,
            activeTool: canvas.activeTool || "select",
            gridEnabled: !!canvas.gridEnabled,
            rulerEnabled: !!canvas.rulerEnabled,
          });
          lastCanvasSyncedRef.current = JSON.stringify({
            slidesByCardId: canvas.slidesByCardId,
            currentSlideId: canvas.currentSlideId,
            activeTool: canvas.activeTool,
            gridEnabled: canvas.gridEnabled,
            rulerEnabled: canvas.rulerEnabled,
          });
        }

        hasLoadedProjectRef.current = projectId;
      } catch (error) {
        console.error("Failed to load project data:", error);
      }
    };

    loadProjectData();
  }, [mounted, user, projectId]);

  // Sync 1: Metadata and Cards
  useEffect(() => {
    if (!mounted || !user || !projectId) return;

    const currentCardsJson = JSON.stringify({
      projectName,
      prompt,
      platform,
      tone,
      aspectRatio,
      numCards,
      themeSettings,
      cards,
      chatHistory,
      assistantHistory,
    });

    if (currentCardsJson === lastCardsSyncedRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        const projectRef = doc(db, `users/${user.uid}/projects/${projectId}`);
        const payload = {
          id: projectId,
          userId: user.uid,
          projectName: projectName || null,
          prompt,
          platform,
          tone,
          aspectRatio,
          numCards,
          themeSettings,
          cards,
          chatHistory,
          assistantHistory,
          updatedAt: serverTimestamp(),
        };

        try {
          await updateDoc(projectRef, payload);
          lastCardsSyncedRef.current = currentCardsJson;
        } catch (updateError: any) {
          if (updateError.code === "not-found") {
            await setDoc(projectRef, {
              ...payload,
              createdAt: serverTimestamp(),
            });
            lastCardsSyncedRef.current = currentCardsJson;
          } else {
            console.error("Metadata sync failed:", updateError);
          }
        }
      } catch (error) {
        console.error("Critical metadata sync failure:", error);
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    projectName,
    prompt,
    platform,
    tone,
    aspectRatio,
    numCards,
    themeSettings,
    cards,
    chatHistory,
    assistantHistory,
    projectId,
    user,
    mounted,
  ]);

  // Sync 2: Canvas State
  useEffect(() => {
    if (
      !mounted ||
      !user ||
      !projectId ||
      Object.keys(canvasSlides).length === 0
    )
      return;

    const currentCanvasJson = JSON.stringify({
      slidesByCardId: canvasSlides,
      currentSlideId: canvasCurrentSlideId,
      activeTool,
      gridEnabled,
      rulerEnabled,
    });

    if (currentCanvasJson === lastCanvasSyncedRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        const projectRef = doc(db, `users/${user.uid}/projects/${projectId}`);
        const canvasPayload = sanitizeForFirestore({
          slidesByCardId: canvasSlides,
          currentSlideId: canvasCurrentSlideId,
          activeTool,
          gridEnabled,
          rulerEnabled,
        });

        try {
          await updateDoc(projectRef, {
            canvas: canvasPayload,
            updatedAt: serverTimestamp(),
          });
        } catch (updateError: any) {
          if (updateError.code === "not-found") {
            await setDoc(
              projectRef,
              {
                id: projectId,
                userId: user.uid,
                canvas: canvasPayload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } else {
            throw updateError;
          }
        }

        lastCanvasSyncedRef.current = currentCanvasJson;
      } catch (error) {
        console.error("Canvas sync failed:", error);
      }
    }, 2000); // Slightly longer debounce for heavy canvas data

    return () => window.clearTimeout(timer);
  }, [
    canvasSlides,
    canvasCurrentSlideId,
    activeTool,
    gridEnabled,
    rulerEnabled,
    projectId,
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
