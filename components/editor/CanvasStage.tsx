"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Layer, Line, Rect, Stage } from "react-konva/lib/ReactKonvaCore";
import "@/lib/konva-shapes";
import type { CanvasSize, CanvasTool, SlideElement } from "@/types/canvas";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { KonvaTransformer } from "@/components/editor/KonvaTransformer";

type Props = {
  canvasSize: CanvasSize;
  elements: SlideElement[];
  selectedIds: string[];
  editingElementId: string | null;
  activeTool: CanvasTool;
  backgroundColor: string;
  gridEnabled: boolean;
  rulerEnabled: boolean;
  onStageReady: (stage: Konva.Stage | null) => void;
  onSelect: (id: string, additive: boolean) => void;
  onSelectMany: (ids: string[]) => void;
  onClearSelection: () => void;
  onAddElement: (element: SlideElement) => void;
  onChangeElement: (id: string, updates: Partial<SlideElement>) => void;
  onPushHistory: () => void;
  onCreateText: (id: string, value: string) => void;
  onDoubleClickText: (id: string) => void;
};

type GuideState = {
  x: number | null;
  y: number | null;
};

type TextDraftState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const uid = () => crypto.randomUUID();
const SNAP_THRESHOLD = 6;
const MIN_TEXT_BOX_WIDTH = 120;
const MIN_TEXT_BOX_HEIGHT = 48;
const CLICK_TO_ADD_TEXT_WIDTH = 360;
const GRID_STEP = 40;
const RULER_STEP = 100;
const RULER_SIZE = 24;

const HEX_COLOR = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

const parseHexRgb = (hex: string) => {
  if (!HEX_COLOR.test(hex)) return null;
  const raw = hex.slice(1);
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : raw;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const getGridStroke = (backgroundColor: string) => {
  const rgb = parseHexRgb(backgroundColor.trim());
  if (!rgb) return "rgba(71,85,105,0.36)";

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.55 ? "rgba(15,23,42,0.22)" : "rgba(241,245,249,0.34)";
};

const normalizeRect = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) => ({
  x: Math.min(startX, endX),
  y: Math.min(startY, endY),
  width: Math.abs(endX - startX),
  height: Math.abs(endY - startY),
});

export function CanvasStage({
  canvasSize,
  elements,
  selectedIds,
  editingElementId,
  activeTool,
  backgroundColor,
  gridEnabled,
  rulerEnabled,
  onStageReady,
  onSelect,
  onSelectMany,
  onClearSelection,
  onAddElement,
  onChangeElement,
  onPushHistory,
  onCreateText,
  onDoubleClickText,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState({ width: 100, height: 100 });
  const [guides, setGuides] = useState<GuideState>({ x: null, y: null });
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, visible: false });
  const [textDraft, setTextDraft] = useState<TextDraftState | null>(null);

  const fit = useMemo(() => {
    const scale = Math.min(
      (viewport.width - 16) / canvasSize.width,
      (viewport.height - 16) / canvasSize.height,
    );
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }, [canvasSize.height, canvasSize.width, viewport.height, viewport.width]);

  const stageOffsetX = (viewport.width - canvasSize.width * fit) / 2;
  const stageOffsetY = (viewport.height - canvasSize.height * fit) / 2;
  const stagePixelWidth = canvasSize.width * fit;
  const stagePixelHeight = canvasSize.height * fit;

  const gridStroke = useMemo(
    () => getGridStroke(backgroundColor),
    [backgroundColor],
  );

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const updateViewport = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      setViewport((prev) => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (stageRef.current) onStageReady(stageRef.current);
    return () => onStageReady(null);
  }, [onStageReady]);

  const textDraftRect = useMemo(() => {
    if (!textDraft || activeTool !== "text") return null;
    return normalizeRect(
      textDraft.startX,
      textDraft.startY,
      textDraft.currentX,
      textDraft.currentY,
    );
  }, [activeTool, textDraft]);

  const rulerTicksX = useMemo(
    () =>
      Array.from({ length: Math.floor(canvasSize.width / RULER_STEP) + 1 }).map(
        (_, i) => {
          const value = i * RULER_STEP;
          return {
            value,
            x: value * fit,
            major: value % (RULER_STEP * 2) === 0,
          };
        },
      ),
    [canvasSize.width, fit],
  );

  const rulerTicksY = useMemo(
    () =>
      Array.from({
        length: Math.floor(canvasSize.height / RULER_STEP) + 1,
      }).map((_, i) => {
        const value = i * RULER_STEP;
        return {
          value,
          y: value * fit,
          major: value % (RULER_STEP * 2) === 0,
        };
      }),
    [canvasSize.height, fit],
  );

  const toCanvasPoint = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - stage.x()) / fit,
      y: (pointer.y - stage.y()) / fit,
    };
  };

  const createTextElement = (x: number, y: number, width: number) => {
    const element: Extract<SlideElement, { type: "text" }> = {
      id: uid(),
      type: "text",
      text: "Edit text",
      x,
      y,
      width,
      fontSize: 54,
      fontFamily: "Inter",
      fontWeight: "600",
      fill: "#111827",
      align: "left",
      lineHeight: 1.25,
      letterSpacing: 0.2,
    };
    onPushHistory();
    onAddElement(element);
    onCreateText(element.id, element.text);
  };

  const createElementAtPoint = (x: number, y: number) => {
    if (activeTool === "shape") {
      onPushHistory();
      onAddElement({
        id: uid(),
        type: "shape",
        shape: "rect",
        x,
        y,
        width: 220,
        height: 160,
        fill: "#2563EB",
        opacity: 0.25,
      });
      return;
    }
    if (activeTool === "image") {
      onPushHistory();
      onAddElement({
        id: uid(),
        type: "image",
        src: "",
        x,
        y,
        width: 380,
        height: 380,
        cornerRadius: 20,
      });
    }
  };

  const handleMouseDown = (evt: Konva.KonvaEventObject<MouseEvent>) => {
    if (typeof evt.evt.button === "number" && evt.evt.button !== 0) {
      evt.evt.preventDefault();
      return;
    }

    const stage = evt.target.getStage();
    if (!stage) return;
    const point = toCanvasPoint(stage);
    if (!point) return;

    if (activeTool === "text") {
      setTextDraft({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      return;
    }

    if (activeTool !== "select") {
      createElementAtPoint(point.x, point.y);
      return;
    }

    const clickedOnEmpty =
      evt.target === stage || evt.target.getParent() === stage;

    if (!clickedOnEmpty) return;

    onClearSelection();
    setSelectionRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      visible: true,
    });
  };

  const handleMouseMove = () => {
    if (textDraft && stageRef.current) {
      const point = toCanvasPoint(stageRef.current);
      if (!point) return;
      setTextDraft((prev) =>
        prev
          ? {
              ...prev,
              currentX: point.x,
              currentY: point.y,
            }
          : prev,
      );
      return;
    }

    if (!selectionRect.visible || !stageRef.current) return;
    const point = toCanvasPoint(stageRef.current);
    if (!point) return;
    setSelectionRect((prev) => ({
      ...prev,
      width: point.x - prev.x,
      height: point.y - prev.y,
    }));
  };

  const handleMouseUp = () => {
    if (textDraft) {
      if (activeTool !== "text") {
        setTextDraft(null);
        return;
      }

      const draft = normalizeRect(
        textDraft.startX,
        textDraft.startY,
        textDraft.currentX,
        textDraft.currentY,
      );
      const clickThreshold = 6;
      const didClick =
        draft.width < clickThreshold && draft.height < clickThreshold;
      const x = didClick ? textDraft.startX : draft.x;
      const y = didClick ? textDraft.startY : draft.y;
      const width = didClick
        ? CLICK_TO_ADD_TEXT_WIDTH
        : Math.max(MIN_TEXT_BOX_WIDTH, draft.width);
      createTextElement(x, y, width);
      setTextDraft(null);
      return;
    }

    if (!selectionRect.visible) return;
    const box = {
      x: Math.min(selectionRect.x, selectionRect.x + selectionRect.width),
      y: Math.min(selectionRect.y, selectionRect.y + selectionRect.height),
      width: Math.abs(selectionRect.width),
      height: Math.abs(selectionRect.height),
    };
    const selected = elements.filter((el) => {
      const width =
        el.type === "shape" && el.shape === "circle"
          ? (el.radius ?? 40) * 2
          : "width" in el
            ? (el.width ?? 0)
            : 0;
      const height =
        el.type === "shape" && el.shape === "circle"
          ? (el.radius ?? 40) * 2
          : "height" in el
            ? (el.height ?? 0)
            : 0;
      return (
        el.x < box.x + box.width &&
        el.x + width > box.x &&
        el.y < box.y + box.height &&
        el.y + height > box.y
      );
    });
    onSelectMany(selected.map((el) => el.id));
    setSelectionRect((prev) => ({
      ...prev,
      visible: false,
      width: 0,
      height: 0,
    }));
  };

  const handleDragMove = useCallback(
    (id: string, x: number, y: number) => {
      const width = canvasSize.width;
      const height = canvasSize.height;
      let nextX = x;
      let nextY = y;
      let guideX: number | null = null;
      let guideY: number | null = null;

      if (Math.abs(x) < SNAP_THRESHOLD) {
        nextX = 0;
        guideX = 0;
      } else if (Math.abs(x + 0 - width / 2) < SNAP_THRESHOLD) {
        nextX = width / 2;
        guideX = width / 2;
      } else if (Math.abs(x - width) < SNAP_THRESHOLD) {
        nextX = width;
        guideX = width;
      }

      if (Math.abs(y) < SNAP_THRESHOLD) {
        nextY = 0;
        guideY = 0;
      } else if (Math.abs(y + 0 - height / 2) < SNAP_THRESHOLD) {
        nextY = height / 2;
        guideY = height / 2;
      } else if (Math.abs(y - height) < SNAP_THRESHOLD) {
        nextY = height;
        guideY = height;
      }

      if (stageRef.current) {
        const node = stageRef.current.findOne(`#${id}`);
        if (node) node.position({ x: nextX, y: nextY });
      }
      setGuides({ x: guideX, y: guideY });
    },
    [canvasSize.width, canvasSize.height],
  );

  const handleDragEnd = useCallback(() => {
    setGuides({ x: null, y: null });
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full bg-muted/20 overflow-hidden select-none"
      style={{ cursor: activeTool === "text" ? "crosshair" : "default" }}
      onContextMenu={(evt) => {
        evt.preventDefault();
      }}
      onDoubleClick={(evt) => {
        evt.preventDefault();
      }}
      onMouseDownCapture={(evt) => {
        if (evt.button !== 0 || evt.detail > 1) {
          evt.preventDefault();
        }
      }}
    >
      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        scale={{ x: fit, y: fit }}
        x={stageOffsetX}
        y={stageOffsetY}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(evt) => {
          evt.evt.preventDefault();
        }}
        onDblClick={(evt) => {
          evt.evt.preventDefault();
        }}
      >
        <Layer>
          {backgroundColor ? (
            <Rect
              width={canvasSize.width}
              height={canvasSize.height}
              fill={backgroundColor}
              listening={false}
            />
          ) : null}
          {gridEnabled
            ? Array.from({
                length: Math.floor(canvasSize.width / GRID_STEP) + 1,
              }).map((_, i) => (
                <Line
                  key={`grid-v-${i}`}
                  points={[i * GRID_STEP, 0, i * GRID_STEP, canvasSize.height]}
                  stroke={gridStroke}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              ))
            : null}
          {gridEnabled
            ? Array.from({
                length: Math.floor(canvasSize.height / GRID_STEP) + 1,
              }).map((_, i) => (
                <Line
                  key={`grid-h-${i}`}
                  points={[0, i * GRID_STEP, canvasSize.width, i * GRID_STEP]}
                  stroke={gridStroke}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              ))
            : null}

          {elements.map((element) => (
            <SlideRenderer
              key={element.id}
              element={element}
              selected={selectedIds.includes(element.id)}
              isSelectMode={activeTool === "select"}
              editingElementId={editingElementId}
              onSelect={onSelect}
              onChange={onChangeElement}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDoubleClickText={onDoubleClickText}
            />
          ))}

          {selectionRect.visible ? (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              stroke="#3B82F6"
              strokeWidth={1}
              fill="rgba(59,130,246,0.18)"
            />
          ) : null}

          {textDraftRect ? (
            <Rect
              x={textDraftRect.x}
              y={textDraftRect.y}
              width={Math.max(textDraftRect.width, MIN_TEXT_BOX_WIDTH)}
              height={Math.max(textDraftRect.height, MIN_TEXT_BOX_HEIGHT)}
              stroke="#14B8A6"
              strokeWidth={1}
              dash={[8, 6]}
              fill="rgba(20,184,166,0.12)"
            />
          ) : null}

          {guides.x !== null ? (
            <Line
              points={[guides.x, 0, guides.x, canvasSize.height]}
              stroke="#22C55E"
              strokeWidth={1}
              dash={[6, 6]}
              strokeScaleEnabled={false}
              listening={false}
            />
          ) : null}
          {guides.y !== null ? (
            <Line
              points={[0, guides.y, canvasSize.width, guides.y]}
              stroke="#22C55E"
              strokeWidth={1}
              dash={[6, 6]}
              strokeScaleEnabled={false}
              listening={false}
            />
          ) : null}

          <KonvaTransformer
            stageRef={stageRef}
            selectedIds={activeTool === "select" ? selectedIds : []}
            elements={elements}
            onTransformEnd={onChangeElement}
          />
        </Layer>
      </Stage>

      {rulerEnabled ? (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute rounded-t-md border border-border/80 bg-card/95 dark:border-slate-600/70 dark:bg-slate-900/80"
            style={{
              top: stageOffsetY,
              left: stageOffsetX,
              width: stagePixelWidth,
              height: RULER_SIZE,
            }}
          >
            {rulerTicksX.map((tick) => (
              <div
                key={`ruler-x-${tick.value}`}
                className="absolute top-0"
                style={{ left: tick.x }}
              >
                <div
                  className="w-px bg-foreground/45 dark:bg-slate-100/85"
                  style={{ height: tick.major ? 12 : 8 }}
                />
                {tick.major ? (
                  <span className="absolute left-1 top-[11px] text-[9px] leading-none text-foreground/85 dark:text-slate-100">
                    {tick.value}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="absolute rounded-l-md border border-border/80 bg-card/95 dark:border-slate-600/70 dark:bg-slate-900/80"
            style={{
              top: stageOffsetY,
              left: stageOffsetX,
              width: RULER_SIZE,
              height: stagePixelHeight,
            }}
          >
            {rulerTicksY.map((tick) => (
              <div
                key={`ruler-y-${tick.value}`}
                className="absolute left-0"
                style={{ top: tick.y }}
              >
                <div
                  className="h-px bg-foreground/45 dark:bg-slate-100/85"
                  style={{ width: tick.major ? 12 : 8 }}
                />
                {tick.major ? (
                  <span className="absolute left-[11px] top-[2px] origin-top-left -rotate-90 text-[9px] leading-none text-foreground/85 dark:text-slate-100">
                    {tick.value}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="absolute rounded-tl-md border border-border/80 bg-card/95 dark:border-slate-600/70 dark:bg-slate-900/90"
            style={{
              top: stageOffsetY,
              left: stageOffsetX,
              width: RULER_SIZE,
              height: RULER_SIZE,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
