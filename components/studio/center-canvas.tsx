"use client";
import { useStudioStore } from "@/store/useStudioStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import {
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasEditor } from "@/components/editor/CanvasEditor";

export function CenterCanvas() {
  const { cards, activeCardId, setActiveCardId } = useStudioStore();
  const setCurrentSlideId = useCanvasStore((s) => s.setCurrentSlideId);
  const { historyPast, historyFuture, undo, redo } = useCanvasStore();

  const activeIndex = cards.findIndex((c) => c.id === activeCardId);
  const activeSlideIndex = activeIndex >= 0 ? activeIndex : 0;

  const selectSlide = (cardId: string) => {
    setActiveCardId(cardId);
    setCurrentSlideId(cardId);
  };

  if (cards.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background/50">
        <div className="text-center">
          <LayoutTemplate className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Your content will appear here
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use the AI Assistant to generate social media content
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-card/30 shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={undo}
              disabled={historyPast.length === 0}
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={redo}
              disabled={historyFuture.length === 0}
            >
              <Redo2 className="w-3.5 h-3.5" />
              Redo
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Slide {activeSlideIndex + 1} of {cards.length}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  selectSlide(cards[Math.max(0, activeSlideIndex - 1)].id)
                }
                disabled={activeSlideIndex === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  selectSlide(
                    cards[Math.min(cards.length - 1, activeSlideIndex + 1)].id,
                  )
                }
                disabled={activeSlideIndex === cards.length - 1}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <CanvasEditor />
      </div>
    </div>
  );
}
