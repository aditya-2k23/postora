"use client";

import type Konva from "konva";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SocialCard, ThemeSettings } from "@/store/useStudioStore";
import type {
  AspectRatio,
  CanvasHistorySnapshot,
  CanvasSlide,
  CanvasTool,
  ImageElement,
  SlideElement,
} from "@/types/canvas";
import { ASPECT_RATIO_DIMENSIONS } from "@/types/canvas";

const HISTORY_LIMIT = 100;
const MAX_PERSISTED_DATA_URL_LENGTH = 12_000;

const uid = () => crypto.randomUUID();

const cloneSlides = (slides: Record<string, CanvasSlide>) =>
  structuredClone(slides);

const sanitizePersistedSlides = (slides: Record<string, CanvasSlide>) => {
  const sanitized: Record<string, CanvasSlide> = {};

  for (const [cardId, slide] of Object.entries(slides)) {
    sanitized[cardId] = {
      ...slide,
      // Keep element geometry and styling, but drop oversized embedded image payloads.
      elements: slide.elements.map((element) => {
        if (element.type !== "image") return element;

        if (
          element.src.startsWith("data:") &&
          element.src.length > MAX_PERSISTED_DATA_URL_LENGTH
        ) {
          return { ...element, src: "" };
        }

        return element;
      }),
    };
  }

  return sanitized;
};

const getCanvasSize = (ratio: string): { width: number; height: number } => {
  const r = ratio as AspectRatio;
  if (r in ASPECT_RATIO_DIMENSIONS) {
    return ASPECT_RATIO_DIMENSIONS[r];
  }
  return ASPECT_RATIO_DIMENSIONS["4:5"];
};

const defaultSlideFromCard = (
  card: SocialCard,
  aspectRatio: string,
  theme: ThemeSettings,
): CanvasSlide => {
  const size = getCanvasSize(aspectRatio);
  const padding = Math.max(32, theme.padding * 2);
  const headingY = size.height * 0.2;
  const bodyY = headingY + theme.fontSize * 4.2;

  const imageElement: ImageElement = {
    id: uid(),
    type: "image",
    src: card.imageUrl ?? "",
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    opacity: theme.style === "minimal" ? 0.2 : 0.55,
    cornerRadius: 0,
  };

  return {
    cardId: card.id,
    backgroundColor: "",
    elements: [
      imageElement,
      {
        id: uid(),
        type: "shape",
        shape: "rect",
        x: padding,
        y: padding * 0.7,
        width: size.width - padding * 2,
        height: 8,
        fill: theme.primaryColor,
        opacity: theme.style === "bold" ? 0.4 : 0.2,
      },
      {
        id: uid(),
        type: "text",
        text: card.title,
        x: padding,
        y: headingY,
        width: size.width - padding * 2,
        fontSize: theme.fontSize * 3,
        fontFamily: "Poppins",
        fontWeight: "700",
        fill: theme.style === "bold" ? "#ffffff" : "#111827",
        align: theme.layoutEngine === "split" ? "left" : "center",
        lineHeight: 1.18,
        letterSpacing: 0.3,
      },
      {
        id: uid(),
        type: "text",
        text: card.content,
        x: padding,
        y: bodyY,
        width: size.width - padding * 2,
        fontSize: theme.fontSize * 1.5,
        fontFamily: "Inter",
        fontWeight: "500",
        fill: theme.style === "bold" ? "#eef2ff" : "#374151",
        align: "left",
        lineHeight: 1.4,
        letterSpacing: 0.1,
      },
    ],
  };
};

const elementWidth = (element: SlideElement) => {
  if (element.type === "text" || element.type === "image") return element.width;
  if (element.shape === "circle") return (element.radius ?? 0) * 2;
  return element.width ?? 0;
};

const elementHeight = (element: SlideElement) => {
  if (element.type === "image") return element.height;
  if (element.type === "text")
    return element.fontSize * (element.lineHeight ?? 1.3);
  if (element.shape === "circle") return (element.radius ?? 0) * 2;
  return element.height ?? 0;
};

const replaceInSlide = (
  slide: CanvasSlide,
  elementId: string,
  updater: (element: SlideElement) => SlideElement,
) => ({
  ...slide,
  elements: slide.elements.map((el) =>
    el.id === elementId ? updater(el) : el,
  ),
});

const withSelected = (
  slide: CanvasSlide | undefined,
  selectedIds: string[],
  updater: (element: SlideElement) => SlideElement,
): CanvasSlide | undefined => {
  if (!slide) return slide;
  return {
    ...slide,
    elements: slide.elements.map((el) =>
      selectedIds.includes(el.id) ? updater(el) : el,
    ),
  };
};

type TextEditState = {
  elementId: string;
  value: string;
};

type CanvasState = {
  slidesByCardId: Record<string, CanvasSlide>;
  currentSlideId: string | null;
  selectedElementIds: string[];
  activeTool: CanvasTool;
  clipboard: SlideElement[] | null;
  historyPast: CanvasHistorySnapshot[];
  historyFuture: CanvasHistorySnapshot[];
  gridEnabled: boolean;
  rulerEnabled: boolean;
  stageRefs: Record<string, Konva.Stage | null>;
  textEditing: TextEditState | null;

  ensureSlidesFromCards: (
    cards: SocialCard[],
    aspectRatio: string,
    theme: ThemeSettings,
  ) => void;
  syncCardContent: (card: SocialCard) => void;
  syncCardImage: (cardId: string, imageUrl?: string) => void;
  setCurrentSlideId: (cardId: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  toggleSelectedElementId: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  setActiveTool: (tool: CanvasTool) => void;
  setBackgroundColor: (color: string) => void;
  addElement: (element: SlideElement) => void;
  updateElement: (elementId: string, updates: Partial<SlideElement>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  moveSelectedBy: (dx: number, dy: number) => void;
  bringForward: () => void;
  sendBackward: () => void;
  alignSelected: (
    direction: "left" | "right" | "top" | "bottom" | "center",
  ) => void;
  distributeSelected: (axis: "horizontal" | "vertical") => void;
  setElementLock: (id: string, locked: boolean) => void;
  setElementVisibility: (id: string, hidden: boolean) => void;
  reorderElement: (fromIndex: number, toIndex: number) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setGridEnabled: (enabled: boolean) => void;
  setRulerEnabled: (enabled: boolean) => void;
  setStageRef: (slideId: string, stage: Konva.Stage | null) => void;
  startTextEditing: (elementId: string, value: string) => void;
  stopTextEditing: () => void;
};

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      slidesByCardId: {},
      currentSlideId: null,
      selectedElementIds: [],
      activeTool: "select",
      clipboard: null,
      historyPast: [],
      historyFuture: [],
      gridEnabled: false,
      rulerEnabled: false,
      stageRefs: {},
      textEditing: null,

      ensureSlidesFromCards: (cards, aspectRatio, theme) =>
        set((state) => {
          const nextSlides: Record<string, CanvasSlide> = {};
          const cardIdSet = new Set(cards.map((c) => c.id));
          const prevSlideKeys = Object.keys(state.slidesByCardId);
          let changed = prevSlideKeys.length !== cards.length;

          for (const card of cards) {
            const existing = state.slidesByCardId[card.id];
            if (existing) {
              nextSlides[card.id] = existing;
            } else {
              changed = true;
              nextSlides[card.id] = defaultSlideFromCard(
                card,
                aspectRatio,
                theme,
              );
            }
          }

          if (!changed) {
            for (const key of prevSlideKeys) {
              if (!cardIdSet.has(key)) {
                changed = true;
                break;
              }
            }
          }

          let nextCurrent = state.currentSlideId;
          if (!nextCurrent || !cardIdSet.has(nextCurrent)) {
            nextCurrent = cards[0]?.id ?? null;
            changed = changed || nextCurrent !== state.currentSlideId;
          }

          const nextSelected = state.selectedElementIds.filter((id) => {
            if (!nextCurrent) return false;
            return nextSlides[nextCurrent]?.elements.some((el) => el.id === id);
          });

          const selectedChanged =
            nextSelected.length !== state.selectedElementIds.length ||
            nextSelected.some(
              (id, idx) => id !== state.selectedElementIds[idx],
            );

          if (!changed && !selectedChanged) {
            return state;
          }

          return {
            slidesByCardId: nextSlides,
            currentSlideId: nextCurrent,
            selectedElementIds: nextSelected,
          };
        }),

      syncCardContent: (card) =>
        set((state) => {
          const slide = state.slidesByCardId[card.id];
          if (!slide) return state;

          const titleElement = slide.elements.find(
            (el) => el.type === "text" && el.fontWeight === "700",
          );
          const bodyElement = slide.elements.find(
            (el) =>
              el.type === "text" &&
              el.id !== titleElement?.id &&
              el.fontWeight !== "700",
          );

          let updated = slide;
          let changed = false;
          if (titleElement && titleElement.type === "text") {
            if (titleElement.text !== card.title) {
              changed = true;
              updated = replaceInSlide(updated, titleElement.id, (el) =>
                el.type === "text" ? { ...el, text: card.title } : el,
              );
            }
          }
          if (bodyElement && bodyElement.type === "text") {
            if (bodyElement.text !== card.content) {
              changed = true;
              updated = replaceInSlide(updated, bodyElement.id, (el) =>
                el.type === "text" ? { ...el, text: card.content } : el,
              );
            }
          }

          if (!changed) {
            return state;
          }

          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [card.id]: updated,
            },
          };
        }),

      syncCardImage: (cardId, imageUrl) =>
        set((state) => {
          const slide = state.slidesByCardId[cardId];
          if (!slide) return state;
          const image = slide.elements.find((el) => el.type === "image");
          if (!image || image.type !== "image") return state;

          const nextSrc = imageUrl ?? "";
          if (image.src === nextSrc) return state;

          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [cardId]: replaceInSlide(slide, image.id, (el) =>
                el.type === "image" ? { ...el, src: nextSrc } : el,
              ),
            },
          };
        }),

      setCurrentSlideId: (cardId) =>
        set((state) => {
          if (state.currentSlideId === cardId) return state;
          return { currentSlideId: cardId, selectedElementIds: [] };
        }),
      setSelectedElementIds: (ids) =>
        set((state) => {
          const sameLength = state.selectedElementIds.length === ids.length;
          const sameValues =
            sameLength &&
            state.selectedElementIds.every(
              (value, index) => value === ids[index],
            );
          if (sameValues) return state;
          return { selectedElementIds: ids };
        }),
      toggleSelectedElementId: (id, additive = false) =>
        set((state) => {
          if (!additive) return { selectedElementIds: [id] };
          const exists = state.selectedElementIds.includes(id);
          return {
            selectedElementIds: exists
              ? state.selectedElementIds.filter((curr) => curr !== id)
              : [...state.selectedElementIds, id],
          };
        }),
      clearSelection: () => set({ selectedElementIds: [] }),
      setActiveTool: (tool) =>
        set((state) => {
          if (state.activeTool === tool) return state;
          return { activeTool: tool };
        }),

      setBackgroundColor: (color) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: {
                ...state.slidesByCardId[current],
                backgroundColor: color,
              },
            },
          };
        }),

      addElement: (element) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: { ...slide, elements: [...slide.elements, element] },
            },
            selectedElementIds: [element.id],
          };
        }),

      updateElement: (elementId, updates) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: replaceInSlide(slide, elementId, (el) => {
                if (el.type === "text") {
                  return { ...el, ...(updates as Partial<typeof el>) };
                }
                if (el.type === "image") {
                  return { ...el, ...(updates as Partial<typeof el>) };
                }
                return { ...el, ...(updates as Partial<typeof el>) };
              }),
            },
          };
        }),

      deleteSelected: () =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: {
                ...slide,
                elements: slide.elements.filter(
                  (el) => !state.selectedElementIds.includes(el.id),
                ),
              },
            },
            selectedElementIds: [],
          };
        }),

      duplicateSelected: () =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;

          const selected = slide.elements.filter((el) =>
            state.selectedElementIds.includes(el.id),
          );
          if (selected.length === 0) return state;
          const duplicated = selected.map((el) => ({
            ...structuredClone(el),
            id: uid(),
            x: el.x + 18,
            y: el.y + 18,
          }));
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: {
                ...slide,
                elements: [...slide.elements, ...duplicated],
              },
            },
            selectedElementIds: duplicated.map((el) => el.id),
          };
        }),

      copySelected: () =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          return {
            clipboard: slide.elements
              .filter((el) => state.selectedElementIds.includes(el.id))
              .map((el) => structuredClone(el)),
          };
        }),

      pasteClipboard: () =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current || !state.clipboard || state.clipboard.length === 0)
            return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          const pasted = state.clipboard.map((el) => ({
            ...structuredClone(el),
            id: uid(),
            x: el.x + 24,
            y: el.y + 24,
          }));
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: {
                ...slide,
                elements: [...slide.elements, ...pasted],
              },
            },
            selectedElementIds: pasted.map((el) => el.id),
          };
        }),

      moveSelectedBy: (dx, dy) =>
        set((state) => {
          const current = state.currentSlideId;
          const slide = current ? state.slidesByCardId[current] : undefined;
          const updated = withSelected(
            slide,
            state.selectedElementIds,
            (el) => ({
              ...el,
              x: el.x + dx,
              y: el.y + dy,
            }),
          );
          if (!current || !updated) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: updated,
            },
          };
        }),

      bringForward: () =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          const elements = [...slide.elements];
          const ids = new Set(state.selectedElementIds);
          for (let i = elements.length - 2; i >= 0; i -= 1) {
            if (ids.has(elements[i].id) && !ids.has(elements[i + 1].id)) {
              [elements[i], elements[i + 1]] = [elements[i + 1], elements[i]];
            }
          }
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: { ...slide, elements },
            },
          };
        }),

      sendBackward: () =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          const elements = [...slide.elements];
          const ids = new Set(state.selectedElementIds);
          for (let i = 1; i < elements.length; i += 1) {
            if (ids.has(elements[i].id) && !ids.has(elements[i - 1].id)) {
              [elements[i], elements[i - 1]] = [elements[i - 1], elements[i]];
            }
          }
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: { ...slide, elements },
            },
          };
        }),

      alignSelected: (direction) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          const selected = slide.elements.filter((el) =>
            state.selectedElementIds.includes(el.id),
          );
          if (selected.length === 0) return state;

          const minX = Math.min(...selected.map((el) => el.x));
          const minY = Math.min(...selected.map((el) => el.y));
          const maxX = Math.max(
            ...selected.map((el) => el.x + elementWidth(el)),
          );
          const maxY = Math.max(
            ...selected.map((el) => el.y + elementHeight(el)),
          );
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          const updated = withSelected(
            slide,
            state.selectedElementIds,
            (el) => {
              const width = elementWidth(el);
              const height = elementHeight(el);
              if (direction === "left") return { ...el, x: minX };
              if (direction === "right") return { ...el, x: maxX - width };
              if (direction === "top") return { ...el, y: minY };
              if (direction === "bottom") return { ...el, y: maxY - height };
              return { ...el, x: centerX - width / 2, y: centerY - height / 2 };
            },
          );

          if (!updated) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: updated,
            },
          };
        }),

      distributeSelected: (axis) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;

          const selected = slide.elements
            .filter((el) => state.selectedElementIds.includes(el.id))
            .slice()
            .sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));

          if (selected.length < 3) return state;

          const first = selected[0];
          const last = selected[selected.length - 1];
          const totalSpan =
            axis === "horizontal" ? last.x - first.x : last.y - first.y;
          const gap = totalSpan / (selected.length - 1);
          const idToPosition = new Map<string, number>();
          selected.forEach((el, idx) => {
            idToPosition.set(
              el.id,
              (axis === "horizontal" ? first.x : first.y) + gap * idx,
            );
          });

          const updated = withSelected(slide, state.selectedElementIds, (el) =>
            axis === "horizontal"
              ? { ...el, x: idToPosition.get(el.id) ?? el.x }
              : { ...el, y: idToPosition.get(el.id) ?? el.y },
          );
          if (!updated) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: updated,
            },
          };
        }),

      setElementLock: (id, locked) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: replaceInSlide(slide, id, (el) => ({ ...el, locked })),
            },
          };
        }),

      setElementVisibility: (id, hidden) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: replaceInSlide(slide, id, (el) => ({ ...el, hidden })),
            },
          };
        }),

      reorderElement: (fromIndex, toIndex) =>
        set((state) => {
          const current = state.currentSlideId;
          if (!current) return state;
          const slide = state.slidesByCardId[current];
          if (!slide) return state;
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= slide.elements.length ||
            toIndex >= slide.elements.length
          ) {
            return state;
          }
          const elements = [...slide.elements];
          const [moved] = elements.splice(fromIndex, 1);
          elements.splice(toIndex, 0, moved);
          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: { ...slide, elements },
            },
          };
        }),

      pushHistory: () =>
        set((state) => {
          const snapshot: CanvasHistorySnapshot = {
            slidesByCardId: cloneSlides(state.slidesByCardId),
            currentSlideId: state.currentSlideId,
            selectedElementIds: [...state.selectedElementIds],
          };
          const historyPast = [...state.historyPast, snapshot].slice(
            -HISTORY_LIMIT,
          );
          return { historyPast, historyFuture: [] };
        }),

      undo: () =>
        set((state) => {
          if (state.historyPast.length === 0) return state;
          const historyPast = [...state.historyPast];
          const previous = historyPast.pop()!;
          const currentSnapshot: CanvasHistorySnapshot = {
            slidesByCardId: cloneSlides(state.slidesByCardId),
            currentSlideId: state.currentSlideId,
            selectedElementIds: [...state.selectedElementIds],
          };
          return {
            historyPast,
            historyFuture: [...state.historyFuture, currentSnapshot],
            slidesByCardId: cloneSlides(previous.slidesByCardId),
            currentSlideId: previous.currentSlideId,
            selectedElementIds: [...previous.selectedElementIds],
          };
        }),

      redo: () =>
        set((state) => {
          if (state.historyFuture.length === 0) return state;
          const historyFuture = [...state.historyFuture];
          const next = historyFuture.pop()!;
          const currentSnapshot: CanvasHistorySnapshot = {
            slidesByCardId: cloneSlides(state.slidesByCardId),
            currentSlideId: state.currentSlideId,
            selectedElementIds: [...state.selectedElementIds],
          };
          return {
            historyFuture,
            historyPast: [...state.historyPast, currentSnapshot].slice(
              -HISTORY_LIMIT,
            ),
            slidesByCardId: cloneSlides(next.slidesByCardId),
            currentSlideId: next.currentSlideId,
            selectedElementIds: [...next.selectedElementIds],
          };
        }),

      setGridEnabled: (enabled) =>
        set((state) => {
          if (state.gridEnabled === enabled) return state;
          return { gridEnabled: enabled };
        }),
      setRulerEnabled: (enabled) =>
        set((state) => {
          if (state.rulerEnabled === enabled) return state;
          return { rulerEnabled: enabled };
        }),
      setStageRef: (slideId, stage) =>
        set((state) => {
          if (state.stageRefs[slideId] === stage) return state;
          return {
            stageRefs: {
              ...state.stageRefs,
              [slideId]: stage,
            },
          };
        }),
      startTextEditing: (elementId, value) =>
        set({ textEditing: { elementId, value } }),
      stopTextEditing: () => set({ textEditing: null }),
    }),
    {
      name: "studio-canvas-storage",
      partialize: (state) => ({
        slidesByCardId: sanitizePersistedSlides(state.slidesByCardId),
        currentSlideId: state.currentSlideId,
        activeTool: state.activeTool,
        gridEnabled: state.gridEnabled,
        rulerEnabled: state.rulerEnabled,
      }),
    },
  ),
);
