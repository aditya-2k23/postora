"use client";

import type Konva from "konva";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/lib/idbStorage";
import {
  useStudioStore,
  type SocialCard,
  type ThemeSettings,
} from "@/store/useStudioStore";
import type {
  CanvasHistorySnapshot,
  CanvasSlide,
  CanvasTool,
  ImageElement,
  SlideElement,
} from "@/types/canvas";
import { ASPECT_RATIO_DIMENSIONS } from "@/types/canvas";
import { AspectRatio } from "@/lib/constants";

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
  const padding = theme.padding ?? 80;
  const isCompact = theme.layoutEngine === "compact";

  // Calculate vertical distribution based on layout engine
  const titleY = isCompact ? size.height * 0.08 : size.height * 0.12;
  const imageY = isCompact ? size.height * 0.22 : size.height * 0.32;
  const imageWidth = isCompact ? size.width * 0.92 : size.width * 0.88;
  const imageHeight = isCompact ? size.height * 0.55 : size.height * 0.45;
  const bodyY = isCompact ? size.height * 0.85 : size.height * 0.82;

  const elements: SlideElement[] = [];

  // 1. Image (Hero style)
  if (card.imageUrl) {
    elements.push({
      id: uid(),
      type: "image",
      src: card.imageUrl,
      x: (size.width - imageWidth) / 2,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
      opacity: 1,
      cornerRadius: theme.roundness ?? 32,
    });
  }

  // 2. Title (Centered top)
  elements.push({
    id: uid(),
    type: "text",
    text: card.title.toUpperCase(),
    x: padding,
    y: titleY,
    width: Math.max(100, size.width - padding * 2),
    fontSize: theme.fontSize * (isCompact ? 3 : 3.5),
    fontFamily: "Poppins",
    fontWeight: "800",
    fill: theme.primaryColor || "#111827",
    align: "center",
    lineHeight: 1.1,
    letterSpacing: 1,
    role: "title",
  });

  // 3. Body (Centered bottom)
  elements.push({
    id: uid(),
    type: "text",
    text: card.content,
    x: padding * 1.5,
    y: bodyY,
    width: Math.max(100, size.width - padding * 3),
    fontSize: theme.fontSize * (isCompact ? 1.6 : 1.8),
    fontFamily: "Inter",
    fontWeight: "500",
    fill: "#6B7280",
    align: "center",
    lineHeight: 1.5,
    role: "body",
  });

  return {
    cardId: card.id,
    backgroundColor: "#ffffff",
    elements,
    ...(card.imageUrl ? { metadata: { autoSynced: true } } : {}),
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
  syncCardImage: (
    cardId: string,
    imageUrl: string,
    targetElementId?: string,
  ) => void;
  setCurrentSlideId: (cardId: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  toggleSelectedElementId: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  setActiveTool: (tool: CanvasTool) => void;
  setBackgroundColor: (color: string) => void;
  addElement: (element: SlideElement) => void;
  updateElement: (
    elementId: string,
    updates: Partial<SlideElement>,
    cardId?: string,
  ) => void;
  deleteSelected: (cardId?: string) => void;
  duplicateSelected: (cardId?: string) => void;
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
  reset: () => void;
};

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      slidesByCardId: {},
      currentSlideId: "default-slide-1",
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

          const titleElement =
            slide.elements.find(
              (el) => el.type === "text" && el.role === "title",
            ) || slide.elements.find((el) => el.type === "text");

          const bodyElement =
            slide.elements.find(
              (el) => el.type === "text" && el.role === "body",
            ) ||
            [...slide.elements]
              .reverse()
              .find((el) => el.type === "text" && el !== titleElement);

          let nextElements = [...slide.elements];
          let changed = false;

          // Sync Title
          if (titleElement && titleElement.type === "text") {
            const transformedTitle = card.title;
            if (titleElement.text !== transformedTitle) {
              changed = true;
              nextElements = nextElements.map((el) =>
                el.id === titleElement.id
                  ? { ...el, text: transformedTitle }
                  : el,
              );
            }
          }

          // Sync Body
          if (bodyElement) {
            if (
              bodyElement.type === "text" &&
              bodyElement.text !== card.content
            ) {
              changed = true;
              nextElements = nextElements.map((el) =>
                el.id === bodyElement.id ? { ...el, text: card.content } : el,
              );
            }
          }

          if (!changed) return state;

          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [card.id]: { ...slide, elements: nextElements },
            },
          };
        }),

      syncCardImage: (cardId, imageUrl, targetElementId) =>
        set((state) => {
          const slide = state.slidesByCardId[cardId];
          if (!slide || !imageUrl) return state;

          const existingImage = targetElementId
            ? slide.elements.find(
                (el) => el.id === targetElementId && el.type === "image",
              )
            : slide.elements.find((el) => el.type === "image");

          if (existingImage && existingImage.type === "image") {
            if (existingImage.src === imageUrl) return state;
            return {
              slidesByCardId: {
                ...state.slidesByCardId,
                [cardId]: {
                  ...slide,
                  metadata: { ...slide.metadata, autoSynced: true },
                  elements: slide.elements.map((el) =>
                    el.id === existingImage.id ? { ...el, src: imageUrl } : el,
                  ),
                },
              },
            };
          }

          // If no image element, but we have an imageUrl, ADD IT.
          // This happens when image generation finishes AFTER the slide shell is created.
          const currentAspectRatio =
            useStudioStore.getState().aspectRatio || "4:5";
          const size = getCanvasSize(currentAspectRatio);
          const imageWidth = size.width * 0.88;
          const imageHeight = size.height * 0.45;
          const imageY = size.height * 0.32;

          const newImage: ImageElement = {
            id: uid(),
            type: "image",
            src: imageUrl,
            x: (size.width - imageWidth) / 2,
            y: imageY,
            width: imageWidth,
            height: imageHeight,
            opacity: 1,
            cornerRadius: 32,
          };

          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [cardId]: {
                ...slide,
                metadata: { ...slide.metadata, autoSynced: true },
                elements: [newImage, ...slide.elements], // Add to bottom (background-ish)
              },
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

          const newMetadata =
            element.type === "image"
              ? { ...slide.metadata, autoSynced: true }
              : slide.metadata;

          return {
            slidesByCardId: {
              ...state.slidesByCardId,
              [current]: {
                ...slide,
                metadata: newMetadata,
                elements: [...slide.elements, element],
              },
            },
            selectedElementIds: [element.id],
          };
        }),

      updateElement: (elementId, updates, cardId) =>
        set((state) => {
          const current = cardId ?? state.currentSlideId;
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

      deleteSelected: (cardId?: string) =>
        set((state) => {
          const current = cardId ?? state.currentSlideId;
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

      duplicateSelected: (cardId?: string) =>
        set((state) => {
          const current = cardId ?? state.currentSlideId;
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
      reset: () =>
        set({
          slidesByCardId: {},
          currentSlideId: "default-slide-1",
          selectedElementIds: [],
          activeTool: "select",
          clipboard: null,
          historyPast: [],
          historyFuture: [],
          gridEnabled: false,
          rulerEnabled: false,
          stageRefs: {},
          textEditing: null,
        }),
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
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
