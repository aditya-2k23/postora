"use client";

import { motion } from "motion/react";
import { toast } from "sonner";
import { LayoutTemplate } from "lucide-react";
import { CanvasSidebar } from "@/components/editor/CanvasSidebar";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStudioStore } from "@/store/useStudioStore";

export function RightSidebar() {
  const { cards, activeCardId, aspectRatio, updateCard } = useStudioStore();
  const {
    slidesByCardId,
    currentSlideId,
    selectedElementIds,
    setSelectedElementIds,
    updateElement,
    pushHistory,
    alignSelected,
    distributeSelected,
    setBackgroundColor,
    reorderElement,
    setElementVisibility,
    setElementLock,
    duplicateSelected,
  } = useCanvasStore();

  const slideId = currentSlideId ?? activeCardId;
  const slide = slideId ? slidesByCardId[slideId] : undefined;
  const currentCard = cards.find((card) => card.id === slideId);

  if (!slide) {
    return (
      <div className="w-full h-full bg-card flex flex-col items-center justify-center text-center p-4">
        <LayoutTemplate className="w-8 h-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">
          Select or generate a slide to edit layers and styles.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: 24, opacity: 0.8 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full"
    >
      <CanvasSidebar
        slideElements={slide.elements}
        selectedIds={selectedElementIds}
        backgroundColor={slide.backgroundColor}
        onBackgroundColor={(color) => {
          pushHistory();
          setBackgroundColor(color);
        }}
        onUpdateElement={(id, updates, applyScope = "single") => {
          pushHistory();

          if (applyScope === "matching-selection") {
            const source = slide.elements.find((el) => el.id === id);
            if (source) {
              const matchingIds = slide.elements
                .filter(
                  (el) =>
                    selectedElementIds.includes(el.id) &&
                    el.type === source.type,
                )
                .map((el) => el.id);

              if (matchingIds.length > 1) {
                matchingIds.forEach((targetId) => {
                  updateElement(targetId, updates);
                });
                return;
              }
            }
          }

          updateElement(id, updates);
        }}
        onAlign={(dir) => {
          pushHistory();
          alignSelected(dir);
        }}
        onDistribute={(axis) => {
          pushHistory();
          distributeSelected(axis);
        }}
        onSelectLayer={(id) => setSelectedElementIds([id])}
        onReorderLayer={(from, to) => {
          pushHistory();
          reorderElement(from, to);
        }}
        onToggleVisibility={(id, hidden) => {
          pushHistory();
          setElementVisibility(id, hidden);
        }}
        onToggleLock={(id, locked) => {
          pushHistory();
          setElementLock(id, locked);
        }}
        onDuplicate={() => {
          pushHistory();
          duplicateSelected();
        }}
        onRegenerateImage={async () => {
          if (!currentCard?.imagePrompt || !currentCard?.id) return;
          try {
            const res = await fetch("/api/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentCard.imagePrompt,
                aspectRatio,
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.imageUrl) {
              throw new Error(data.error || "Failed to regenerate image");
            }
            updateCard(currentCard.id, { imageUrl: data.imageUrl });
            toast.success("Image regenerated");
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to regenerate image";
            toast.error(message);
          }
        }}
        onReplaceImage={(file) => {
          const reader = new FileReader();
          reader.onload = () => {
            const selectedImage = slide.elements.find(
              (el) => selectedElementIds.includes(el.id) && el.type === "image",
            );
            if (!selectedImage || typeof reader.result !== "string") return;
            pushHistory();
            updateElement(selectedImage.id, { src: reader.result });
          };
          reader.readAsDataURL(file);
        }}
      />
    </motion.div>
  );
}
