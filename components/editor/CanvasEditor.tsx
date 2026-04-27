"use client";

import { useEffect, useState, useRef } from "react";
import type Konva from "konva";
import {
  ASPECT_RATIO_DIMENSIONS,
  SlideElement,
  type AspectRatio,
} from "@/types/canvas";
import { useShallow } from "zustand/shallow";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStudioStore } from "@/store/useStudioStore";
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { CanvasStage } from "@/components/editor/CanvasStage";
import { TextEditorOverlay } from "@/components/editor/TextEditorOverlay";
import { LayoutTemplate } from "lucide-react";

const isTypingTarget = (target: any) => {
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (target.isContentEditable) return true;
  return !!(target.closest && target.closest("[contenteditable='true']"));
};

export function CanvasEditor() {
  const { cards, activeCardId, aspectRatio, updateCard, themeSettings } =
    useStudioStore(
      useShallow((s) => ({
        cards: s.cards,
        activeCardId: s.activeCardId,
        aspectRatio: s.aspectRatio,
        updateCard: s.updateCard,
        themeSettings: s.themeSettings,
      })),
    );

  const {
    slidesByCardId,
    currentSlideId,
    selectedElementIds,
    activeTool,
    clipboard,
    historyPast,
    historyFuture,
    gridEnabled,
    rulerEnabled,
    textEditing,
    ensureSlidesFromCards,
    syncCardContent,
    syncCardImage,
    setCurrentSlideId,
    setSelectedElementIds,
    toggleSelectedElementId,
    clearSelection,
    setActiveTool,
    addElement,
    updateElement,
    pushHistory,
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    moveSelectedBy,
    bringForward,
    sendBackward,
    undo,
    redo,
    setGridEnabled,
    setRulerEnabled,
    setStageRef,
    startTextEditing,
    stopTextEditing,
  } = useCanvasStore(
    useShallow((s) => ({
      slidesByCardId: s.slidesByCardId,
      currentSlideId: s.currentSlideId,
      selectedElementIds: s.selectedElementIds,
      activeTool: s.activeTool,
      clipboard: s.clipboard,
      historyPast: s.historyPast,
      historyFuture: s.historyFuture,
      gridEnabled: s.gridEnabled,
      rulerEnabled: s.rulerEnabled,
      textEditing: s.textEditing,
      ensureSlidesFromCards: s.ensureSlidesFromCards,
      syncCardContent: s.syncCardContent,
      syncCardImage: s.syncCardImage,
      setCurrentSlideId: s.setCurrentSlideId,
      setSelectedElementIds: s.setSelectedElementIds,
      toggleSelectedElementId: s.toggleSelectedElementId,
      clearSelection: s.clearSelection,
      setActiveTool: s.setActiveTool,
      addElement: s.addElement,
      updateElement: s.updateElement,
      pushHistory: s.pushHistory,
      deleteSelected: s.deleteSelected,
      duplicateSelected: s.duplicateSelected,
      copySelected: s.copySelected,
      pasteClipboard: s.pasteClipboard,
      moveSelectedBy: s.moveSelectedBy,
      bringForward: s.bringForward,
      sendBackward: s.sendBackward,
      undo: s.undo,
      redo: s.redo,
      setGridEnabled: s.setGridEnabled,
      setRulerEnabled: s.setRulerEnabled,
      setStageRef: s.setStageRef,
      startTextEditing: s.startTextEditing,
      stopTextEditing: s.stopTextEditing,
    })),
  );

  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const slideId = activeCardId ?? currentSlideId;
  const slide = slideId ? slidesByCardId[slideId] : undefined;
  const canvasSize =
    ASPECT_RATIO_DIMENSIONS[(aspectRatio as AspectRatio) || "4:5"];

  const slideRef = useRef(slide);
  const selectedElementIdsRef = useRef(selectedElementIds);
  const editorRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    slideRef.current = slide;
    selectedElementIdsRef.current = selectedElementIds;
  }, [slide, selectedElementIds]);

  useEffect(() => {
    ensureSlidesFromCards(cards, aspectRatio, themeSettings);
  }, [cards, aspectRatio, themeSettings, ensureSlidesFromCards]);

  useEffect(() => {
    cards.forEach((card) => {
      syncCardContent(card);

      const cardSlide = slidesByCardId[card.id];
      if (!cardSlide) return;

      const hasImage = cardSlide.elements.some((el) => el.type === "image");
      const isUnpopulated =
        cardSlide.elements.length === 0 ||
        cardSlide.metadata?.autoSynced === undefined;

      // Only auto-sync image if card has one and the slide hasn't been synced or is empty
      // This prevents resurrecting images the user might have deleted.
      if (card.imageUrl && !hasImage && isUnpopulated) {
        syncCardImage(card.id, card.imageUrl);
      }
    });
  }, [cards, syncCardContent, syncCardImage, slidesByCardId]);

  useEffect(() => {
    if (activeCardId && activeCardId !== currentSlideId) {
      setCurrentSlideId(activeCardId);
    }
  }, [activeCardId, currentSlideId, setCurrentSlideId]);

  useEffect(() => {
    if (activeTool !== "select" && selectedElementIds.length > 0) {
      clearSelection();
    }
  }, [activeTool, selectedElementIds.length, clearSelection]);

  useEffect(() => {
    if (!slideId || !stage) return;
    setStageRef(slideId, stage);
    return () => setStageRef(slideId, null);
  }, [slideId, stage, setStageRef]);

  // 4. Keyboard Shortcuts
  useEffect(() => {
    const handler = (evt: KeyboardEvent) => {
      const isMeta = evt.metaKey || evt.ctrlKey;
      const key = evt.key.toLowerCase();
      const target = evt.target as HTMLElement;

      // 1. Check for global commands that we want to intercept early
      // Note: We use capturing phase to beat browser defaults like Ctrl+D (bookmark), Ctrl+Y (history)
      const isShortcut =
        isMeta &&
        (key === "d" ||
          key === "z" ||
          key === "y" ||
          key === "c" ||
          key === "v" ||
          key === "s");
      const isDelete = key === "delete" || key === "backspace";

      if ((isShortcut || isDelete) && !isTypingTarget(target)) {
        if (isMeta && key === "d") evt.preventDefault();
        if (isMeta && key === "z") evt.preventDefault();
        if (isMeta && key === "y") evt.preventDefault();
        if (isDelete && selectedElementIdsRef.current.length > 0)
          evt.preventDefault();
      }

      if (isTypingTarget(target)) return;

      // Undo/Redo
      if (isMeta && key === "z") {
        if (evt.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isMeta && key === "y") {
        redo();
        return;
      }

      // Grid/Ruler shortcuts (Shift + G / Shift + R)
      if (evt.shiftKey && !isMeta) {
        if (key === "g") {
          evt.preventDefault();
          setGridEnabled(!gridEnabled);
          return;
        }
        if (key === "r") {
          evt.preventDefault();
          setRulerEnabled(!rulerEnabled);
          return;
        }
      }

      // Tool selection shortcuts
      if (!isMeta) {
        if (key === "v" || key === "escape") {
          setActiveTool("select");
          return;
        }
        if (key === "t") {
          setActiveTool("text");
          return;
        }
        if (key === "g") {
          setActiveTool("grab");
          return;
        }
      }

      // Slide-specific actions
      const currentSlide = slideRef.current;
      if (!currentSlide) return;
      const slideId = currentSlide.cardId;

      if (isMeta && key === "c") {
        if (selectedElementIdsRef.current.length > 0) {
          evt.preventDefault();
          copySelected();
        }
        return;
      }

      if (isMeta && key === "v") {
        // Handle Ctrl+V separately to allow single-key 'v' for tool
        evt.preventDefault();
        pushHistory();
        pasteClipboard();
        return;
      }

      if (isMeta && key === "d") {
        pushHistory();
        duplicateSelected(slideId);
        return;
      }

      if (isDelete) {
        if (selectedElementIdsRef.current.length > 0) {
          pushHistory();
          deleteSelected(slideId);
        }
        return;
      }

      if (evt.key.startsWith("Arrow")) {
        const amount = evt.shiftKey ? 10 : 1;
        if (selectedElementIdsRef.current.length === 0) return;
        evt.preventDefault();
        pushHistory();
        if (evt.key === "ArrowUp") moveSelectedBy(0, -amount);
        if (evt.key === "ArrowDown") moveSelectedBy(0, amount);
        if (evt.key === "ArrowLeft") moveSelectedBy(-amount, 0);
        if (evt.key === "ArrowRight") moveSelectedBy(amount, 0);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    copySelected,
    pasteClipboard,
    deleteSelected,
    duplicateSelected,
    pushHistory,
    undo,
    redo,
    setActiveTool,
    moveSelectedBy,
    gridEnabled,
    rulerEnabled,
    setGridEnabled,
    setRulerEnabled,
  ]);

  if (!cards.length || !slide) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background/50">
        <LayoutTemplate className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">
          No slide selected
        </h3>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Generate content first, then edit the slide visually.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex overflow-hidden" ref={editorRootRef}>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <CanvasToolbar
          activeTool={activeTool}
          canUndo={historyPast.length > 0}
          canRedo={historyFuture.length > 0}
          hasSelection={selectedElementIds.length > 0}
          canPaste={Boolean(clipboard && clipboard.length > 0)}
          onToolChange={setActiveTool}
          onUndo={undo}
          onRedo={redo}
          onCopy={copySelected}
          onPaste={() => {
            pushHistory();
            pasteClipboard();
          }}
          onDuplicate={() => {
            pushHistory();
            duplicateSelected(slide.cardId);
          }}
          onBringForward={() => {
            pushHistory();
            bringForward();
          }}
          onSendBackward={() => {
            pushHistory();
            sendBackward();
          }}
          onDelete={() => {
            pushHistory();
            deleteSelected(slide.cardId);
          }}
          gridEnabled={gridEnabled}
          rulerEnabled={rulerEnabled}
          onToggleGrid={() => setGridEnabled(!gridEnabled)}
          onToggleRuler={() => setRulerEnabled(!rulerEnabled)}
        />

        <CanvasStage
          canvasSize={canvasSize}
          elements={slide.elements}
          selectedIds={selectedElementIds}
          editingElementId={textEditing?.elementId ?? null}
          activeTool={activeTool}
          backgroundColor={slide.backgroundColor}
          gridEnabled={gridEnabled}
          rulerEnabled={rulerEnabled}
          onStageReady={setStage}
          onSelect={(id, additive) => toggleSelectedElementId(id, additive)}
          onSelectMany={(ids) => setSelectedElementIds(ids)}
          onClearSelection={clearSelection}
          onAddElement={addElement}
          onChangeElement={updateElement}
          onPushHistory={pushHistory}
          onCreateText={(id, value) => {
            setActiveTool("select");
            startTextEditing(id, value);
          }}
          onDoubleClickText={(id) => {
            const node = slide.elements.find(
              (el) => el.id === id && el.type === "text",
            );
            if (node?.type === "text") {
              startTextEditing(node.id, node.text);
            }
          }}
        />

        <TextEditorOverlay
          key={textEditing?.elementId ?? "none"}
          stage={stage}
          editingElementId={textEditing?.elementId ?? null}
          elements={slide.elements}
          onCommit={(id, value) => {
            // Get the latest state from the store to avoid closure staleness
            const state = useCanvasStore.getState();
            const slideId = activeCardId ?? state.currentSlideId;
            const currentSlide = slideId ? state.slidesByCardId[slideId] : null;

            if (!currentSlide) {
              stopTextEditing();
              return;
            }

            const currentElement = currentSlide.elements.find(
              (el): el is Extract<SlideElement, { type: "text" }> =>
                el.type === "text" && el.id === id,
            );

            if (!currentElement) {
              stopTextEditing();
              return;
            }

            // Only update if value actually changed
            if (currentElement.text !== value) {
              pushHistory();
              updateElement(id, { text: value }, slideId ?? undefined);

              // Sync back to card
              if (activeCardId) {
                if (currentElement.role === "title") {
                  updateCard(activeCardId, { title: value });
                } else if (currentElement.role === "body") {
                  updateCard(activeCardId, { content: value });
                }
              }
            }

            // Defer cleanup to next tick to ensure store updates are processed
            setTimeout(() => {
              stopTextEditing();
              // Deselect the element after editing as requested by the user
              clearSelection();
            }, 0);
          }}
          onCancel={stopTextEditing}
        />
      </div>
    </div>
  );
}
