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
import { useState } from "react";

function SortableThumbnail({
  card,
  index,
  isActive,
  onClick,
  aspectRatio,
  accentColor,
}: {
  card: SocialCard;
  index: number;
  isActive: boolean;
  onClick: () => void;
  aspectRatio: string;
  accentColor: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [aspectW, aspectH] = aspectRatio.split(":").map(Number);
  const ratio = aspectW / aspectH;

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`h-20 cursor-pointer rounded-lg overflow-hidden border-2 transition-all relative ${
          isActive
            ? "shadow-md"
            : "border-transparent hover:border-muted-foreground/30"
        }`}
        style={{
          aspectRatio: ratio || 1,
          ...style,
          ...(isActive
            ? { borderColor: accentColor, boxShadow: `0 4px 12px ${accentColor}33` }
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
  const { cards, activeCardId, setActiveCardId, setCards, aspectRatio, themeSettings } =
    useStudioStore();
  const [showHint, setShowHint] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cards.findIndex((c) => c.id === active.id);
      const newIndex = cards.findIndex((c) => c.id === over.id);
      setCards(arrayMove(cards, oldIndex, newIndex));
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="border-t border-border bg-card/50 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Slide Manager</span>
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
            <div className="flex gap-3 overflow-x-auto py-1">
              {cards.map((c, i) => (
                <SortableThumbnail
                  key={c.id}
                  card={c}
                  index={i}
                  isActive={activeCardId === c.id}
                  onClick={() => setActiveCardId(c.id)}
                  aspectRatio={aspectRatio}
                  accentColor={themeSettings.primaryColor}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
