"use client";

import { useEffect, useState } from "react";
import type Konva from "konva";
import { ASPECT_RATIO_DIMENSIONS, type AspectRatio } from "@/types/canvas";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStudioStore } from "@/store/useStudioStore";
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { CanvasStage } from "@/components/editor/CanvasStage";
import { TextEditorOverlay } from "@/components/editor/TextEditorOverlay";
import { LayoutTemplate } from "lucide-react";

export function CanvasEditor() {
  const { cards, activeCardId, aspectRatio, themeSettings } = useStudioStore();
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
  } = useCanvasStore();

  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const slideId = activeCardId ?? currentSlideId;
  const slide = slideId ? slidesByCardId[slideId] : undefined;
  const canvasSize =
    ASPECT_RATIO_DIMENSIONS[(aspectRatio as AspectRatio) || "4:5"];

  useEffect(() => {
    ensureSlidesFromCards(cards, aspectRatio, themeSettings);
  }, [cards, aspectRatio, themeSettings, ensureSlidesFromCards]);

  useEffect(() => {
    cards.forEach((card) => {
      syncCardContent(card);
      syncCardImage(card.id, card.imageUrl);
    });
  }, [cards, syncCardContent, syncCardImage]);

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

  useEffect(() => {
    const handler = (evt: KeyboardEvent) => {
      const isMeta = evt.metaKey || evt.ctrlKey;
      if (isMeta && evt.key.toLowerCase() === "z") {
        evt.preventDefault();
        if (evt.shiftKey) redo();
        else undo();
        return;
      }
      if (isMeta && evt.key.toLowerCase() === "c") {
        copySelected();
        return;
      }
      if (isMeta && evt.key.toLowerCase() === "v") {
        evt.preventDefault();
        pushHistory();
        pasteClipboard();
        return;
      }
      if (evt.key === "Delete" || evt.key === "Backspace") {
        if (selectedElementIds.length === 0) return;
        evt.preventDefault();
        pushHistory();
        deleteSelected();
        return;
      }
      if (evt.key.startsWith("Arrow")) {
        const amount = evt.shiftKey ? 10 : 1;
        if (selectedElementIds.length === 0) return;
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
    deleteSelected,
    moveSelectedBy,
    pasteClipboard,
    pushHistory,
    redo,
    selectedElementIds.length,
    undo,
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
    <div className="w-full h-full flex overflow-hidden">
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
            duplicateSelected();
          }}
          onBringForward={() => {
            pushHistory();
            bringForward();
          }}
          onSendBackward={() => {
            pushHistory();
            sendBackward();
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
          stage={stage}
          editingElementId={textEditing?.elementId ?? null}
          elements={slide.elements}
          onCommit={(value) => {
            if (!textEditing?.elementId) return;
            pushHistory();
            updateElement(textEditing.elementId, { text: value });
            stopTextEditing();
          }}
          onCancel={stopTextEditing}
        />
      </div>
    </div>
  );
}
