"use client";

import { useStudioStore, SocialCard } from "@/store/useStudioStore";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useAuth } from "@/components/auth-provider";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function SortableThumbnail({
  card,
  index,
  isActive,
  onClick,
  aspectRatio,
  accentColor,
  isRecentlyReordered,
}: {
  card: SocialCard;
  index: number;
  isActive: boolean;
  onClick: () => void;
  aspectRatio: string;
  accentColor: string;
  isRecentlyReordered: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: card.id,
      transition: {
        duration: 220,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    });

  const sortableTransition = transition
    ? `${transition}, box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1), border-color 220ms cubic-bezier(0.4, 0, 0.2, 1)`
    : "box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1), border-color 220ms cubic-bezier(0.4, 0, 0.2, 1)";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: sortableTransition,
  };

  const [aspectW, aspectH] = aspectRatio.split(":").map(Number);
  const ratio = aspectW / aspectH;
  const activeShadow = `0 4px 12px ${accentColor}33`;
  const reorderShadow = `0 0 0 2px ${accentColor}40, 0 8px 18px ${accentColor}26`;

  const boxShadow = isActive
    ? isRecentlyReordered
      ? `${activeShadow}, ${reorderShadow}`
      : activeShadow
    : isRecentlyReordered
      ? reorderShadow
      : undefined;

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`h-20 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ease-in-out relative ${
          isActive
            ? "shadow-md"
            : "border-transparent hover:border-muted-foreground/30"
        }`}
        style={{
          aspectRatio: ratio || 1,
          ...style,
          ...(isActive || isRecentlyReordered
            ? {
                borderColor: accentColor,
                boxShadow,
              }
            : {}),
        }}
      >
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt="thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-muted/60" />
        )}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-in-out ${
            isRecentlyReordered ? "opacity-100" : "opacity-0"
          }`}
          style={{
            backgroundColor: isRecentlyReordered
              ? `${accentColor}22`
              : "transparent",
          }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <span className="absolute bottom-1 left-1 right-1 text-[7px] font-medium text-white drop-shadow-md truncate px-0.5">
          {card.title.slice(0, 20)}
        </span>
      </div>
      <span
        className="text-[10px] font-medium"
        style={{ color: isActive ? accentColor : undefined }}
      >
        <span className={isActive ? "" : "text-muted-foreground"}>
          Slide {index + 1}
        </span>
      </span>
    </div>
  );
}

export function SlideManager() {
  const {
    cards,
    activeCardId,
    setActiveCardId,
    setCards,
    aspectRatio,
    themeSettings,
  } = useStudioStore();
  const setCurrentSlideId = useCanvasStore((s) => s.setCurrentSlideId);
  const [showHint, setShowHint] = useState(true);
  const [recentlyReorderedCardId, setRecentlyReorderedCardId] = useState<
    string | null
  >(null);
  const reorderPulseTimeoutRef = useRef<number | null>(null);

  const { user } = useAuth();
  const router = useRouter();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleAddSlide = () => {
    if (!user && cards.length >= 3) {
      setShowLimitModal(true);
      return;
    }

    const newCard: SocialCard = {
      id: crypto.randomUUID(),
      title: "New Slide",
      content: "Add your text here...",
    };

    setCards([...cards, newCard]);
    selectSlide(newCard.id);
  };

  const selectSlide = useCallback(
    (cardId: string) => {
      setActiveCardId(cardId);
      setCurrentSlideId(cardId);
    },
    [setActiveCardId, setCurrentSlideId],
  );

  const pulseReorderedSlide = useCallback((cardId: string) => {
    setRecentlyReorderedCardId(cardId);
    if (reorderPulseTimeoutRef.current) {
      window.clearTimeout(reorderPulseTimeoutRef.current);
    }
    reorderPulseTimeoutRef.current = window.setTimeout(() => {
      setRecentlyReorderedCardId((current) =>
        current === cardId ? null : current,
      );
    }, 320);
  }, []);

  useEffect(() => {
    return () => {
      if (reorderPulseTimeoutRef.current) {
        window.clearTimeout(reorderPulseTimeoutRef.current);
      }
    };
  }, []);

  const handleManagerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Only navigate when the slide manager container itself has focus.
      if (event.target !== event.currentTarget) return;

      if (cards.length <= 1) return;

      const isHorizontalNextKey = event.key === "ArrowRight";
      const isHorizontalPrevKey = event.key === "ArrowLeft";
      const isNextKey = isHorizontalNextKey || event.key === "ArrowDown";
      const isPrevKey = isHorizontalPrevKey || event.key === "ArrowUp";

      if (!isNextKey && !isPrevKey) return;

      const currentIndex = Math.max(
        cards.findIndex((card) => card.id === activeCardId),
        0,
      );

      if (event.ctrlKey && (isHorizontalNextKey || isHorizontalPrevKey)) {
        event.preventDefault();

        const targetIndex = isHorizontalNextKey
          ? Math.min(currentIndex + 1, cards.length - 1)
          : Math.max(currentIndex - 1, 0);

        if (targetIndex === currentIndex) return;

        const movedCardId = cards[currentIndex].id;
        setCards(arrayMove(cards, currentIndex, targetIndex));
        selectSlide(movedCardId);
        pulseReorderedSlide(movedCardId);
        return;
      }

      event.preventDefault();

      const nextIndex = isNextKey
        ? (currentIndex + 1) % cards.length
        : (currentIndex - 1 + cards.length) % cards.length;

      selectSlide(cards[nextIndex].id);
    },
    [activeCardId, cards, pulseReorderedSlide, selectSlide, setCards],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cards.findIndex((c) => c.id === active.id);
      const newIndex = cards.findIndex((c) => c.id === over.id);
      setCards(arrayMove(cards, oldIndex, newIndex));
      pulseReorderedSlide(String(active.id));
    }
  };

  // Removed early return null for empty cards to ensure 'Add Slide' button is always reachable.
  // if (cards.length === 0) return null;

  return (
    <div
      className="w-full h-full bg-card/50 flex flex-col shrink-0 min-w-0 min-h-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      tabIndex={0}
      role="region"
      aria-label="Slide manager"
      onKeyDown={handleManagerKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Slide Manager
          </span>
        </div>
        {showHint && (
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-0.5">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Drag and drop reorderable
            </span>
            <button
              onClick={() => setShowHint(false)}
              className="text-muted-foreground hover:text-foreground ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className="px-4 pb-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 overflow-x-auto py-1 min-w-0">
              {cards.map((c, i) => (
                <SortableThumbnail
                  key={c.id}
                  card={c}
                  index={i}
                  isActive={activeCardId === c.id}
                  onClick={() => selectSlide(c.id)}
                  aspectRatio={aspectRatio}
                  accentColor={themeSettings.primaryColor}
                  isRecentlyReordered={recentlyReorderedCardId === c.id}
                />
              ))}

              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <button
                  onClick={handleAddSlide}
                  className="h-20 w-16 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Add Slide"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-medium text-muted-foreground opacity-0 pointer-events-none">
                  Hidden
                </span>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Unlock More Slides</DialogTitle>
            <DialogDescription className="py-2">
              You've reached the 3-slide limit for guest users. Sign up or log
              in to create unlimited slides, use our AI generation features, and
              securely save your project!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowLimitModal(false)}
              className="font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={() => router.push("/login?redirect=/studio&intent=save")}
              className="font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sign Up to add more!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
