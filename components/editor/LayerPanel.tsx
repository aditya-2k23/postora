"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableLayerItem } from "./SortableLayerItem";
import type { SlideElement } from "@/types/canvas";

type Props = {
  elements: SlideElement[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggleVisibility: (id: string, hidden: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
};

export function LayerPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onToggleVisibility,
  onToggleLock,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reversed layers for UI (Front-most at top)
  const layers = [...elements].map((el, index) => ({ el, index })).reverse();
  const layerIds = layers.map(l => l.el.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldUIIndex = layerIds.indexOf(active.id as string);
    const newUIIndex = layerIds.indexOf(over.id as string);

    // Map UI indices (reversed) back to elements indices
    const fromIndex = elements.length - 1 - oldUIIndex;
    const toIndex = elements.length - 1 - newUIIndex;

    onReorder(fromIndex, toIndex);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        Layers
      </p>
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={layerIds}
            strategy={verticalListSortingStrategy}
          >
            {layers.map(({ el, index }) => (
              <SortableLayerItem
                key={el.id}
                id={el.id}
                element={el}
                index={index}
                total={elements.length}
                isSelected={selectedIds.includes(el.id)}
                onSelect={onSelect}
                onReorder={onReorder}
                onToggleVisibility={onToggleVisibility}
                onToggleLock={onToggleLock}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
