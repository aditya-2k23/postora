"use client";

import { motion } from "motion/react";
import { toast } from "sonner";
import { LayoutTemplate } from "lucide-react";
import { CanvasSidebar } from "@/components/editor/CanvasSidebar";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStudioStore } from "@/store/useStudioStore";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RightSidebar() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const { cards, activeCardId, aspectRatio, updateCard, themeSettings } =
    useStudioStore();
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
    addElement,
  } = useCanvasStore();

  const slideId = currentSlideId ?? activeCardId;
  const slide = slideId ? slidesByCardId[slideId] : undefined;
  const currentCard = cards.find((card) => card.id === slideId);
  const accent = themeSettings.primaryColor;

  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);

  const requireAiToken = async () => {
    if (loading) {
      throw new Error("Checking sign-in status. Please try again in a moment.");
    }

    if (!user) {
      router.push("/login");
      throw new Error("Please sign in to use AI features.");
    }

    return user.getIdToken();
  };

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
        onUpdateElement={(id, updates, options) => {
          const { applyScope = "single", pushHistory: shouldPush = false } =
            options || {};

          if (shouldPush || applyScope === "matching-selection") {
            pushHistory();
          }

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

          // Sync back to card store if it's a role-based text element
          if (updates.text !== undefined && slideId) {
            const el = slide.elements.find((e) => e.id === id);
            if (el?.role === "title") updateCard(slideId, { title: updates.text });
            if (el?.role === "body") updateCard(slideId, { content: updates.text });
          }
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
          setIsRegeneratingImage(true);
          const loadingToast = toast.loading("Regenerating image...");

          try {
            const authToken = await requireAiToken();
            const selectedImage = slide.elements.find(
              (el) => selectedElementIds.includes(el.id) && el.type === "image",
            );

            const res = await fetch("/api/generate-image", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
                "x-idempotency-key": crypto.randomUUID(),
              },
              body: JSON.stringify({
                prompt: currentCard.imagePrompt,
                aspectRatio,
                style: themeSettings.style,
                projectId: useStudioStore.getState().projectId,
                cardId: currentCard.id,
              }),
            });
            const data = await res.json();

            if (!res.ok) {
              if (res.status === 429) {
                throw new Error(
                  data.errorType === "RateLimitExceeded"
                    ? "Too many requests. Please slow down and try again."
                    : "You've reached your daily AI limit. Please come back tomorrow.",
                );
              }
              throw new Error(data.error || "Failed to regenerate image");
            }
            if (!data.imageUrl) {
              throw new Error("Failed to regenerate image");
            }

            if (data.quotaRemaining !== undefined) {
              useStudioStore.getState().setQuotaRemaining(data.quotaRemaining);
            }

            updateCard(currentCard.id, { imageUrl: data.imageUrl });
            useCanvasStore
              .getState()
              .syncCardImage(
                currentCard.id,
                data.imageUrl,
                selectedImage?.id,
              );
            toast.dismiss(loadingToast);
            toast.success("Image regenerated");
          } catch (error: unknown) {
            toast.dismiss(loadingToast);
            const message =
              error instanceof Error
                ? error.message
                : "Failed to regenerate image";
            toast.error(message);
          } finally {
            setIsRegeneratingImage(false);
          }
        }}
        isRegenerating={isRegeneratingImage}
        onReplaceImage={async (file) => {
          const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
          if (!file.type.startsWith("image/")) {
            toast.error("Invalid file type. Please upload an image.");
            return;
          }
          if (file.size > MAX_IMAGE_BYTES) {
            toast.error("Image is too large. Max size is 5MB.");
            return;
          }

          const selectedImage = slide.elements.find(
            (el) => selectedElementIds.includes(el.id) && el.type === "image",
          );
          if (!selectedImage) return;

          const reader = new FileReader();
          reader.onload = async () => {
            if (typeof reader.result !== "string") return;

            try {
              const authToken = await requireAiToken();
              const res = await fetch("/api/upload-image", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ imageBase64: reader.result }),
              });

              const data = await res.json();
              if (!res.ok) {
                throw new Error(data.error || "Upload failed");
              }

              const { imageUrl } = data;
              pushHistory();
              updateElement(selectedImage.id, { src: imageUrl });
              toast.success("Image updated");
            } catch (error: any) {
              toast.error(error.message || "Failed to upload image");
            }
          };
          reader.readAsDataURL(file);
        }}
        onAddElement={(type) => {
          pushHistory();
          const id = crypto.randomUUID();

          if (type === "text") {
            addElement({
              id,
              type: "text",
              text: "New Text",
              x: 100,
              y: 100,
              width: 600,
              fontSize: 48,
              fontFamily: "Inter",
              fill: "#000000",
              align: "left",
            });
          } else if (type === "shape") {
            addElement({
              id,
              type: "shape",
              shape: "rect",
              x: 150,
              y: 150,
              width: 150,
              height: 150,
              fill: accent, // Use primary brand color
              opacity: 0.5,
            });
          } else if (type === "image") {
            addElement({
              id,
              type: "image",
              src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
              x: 100,
              y: 100,
              width: 300,
              height: 300,
              opacity: 1,
              cornerRadius: 0,
            });
          }
        }}
      />
    </motion.div>
  );
}
