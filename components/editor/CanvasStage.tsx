"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Layer, Line, Rect, Stage } from "react-konva";
import type { CanvasSize, CanvasTool, SlideElement } from "@/types/canvas";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { KonvaTransformer } from "@/components/editor/KonvaTransformer";

type Props = {
  canvasSize: CanvasSize;
  elements: SlideElement[];
  selectedIds: string[];
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
  onDoubleClickText: (id: string) => void;
};

type GuideState = {
  x: number | null;
  y: number | null;
};

const uid = () => crypto.randomUUID();
const SNAP_THRESHOLD = 6;

export function CanvasStage({
  canvasSize,
  elements,
  selectedIds,
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

  const fit = useMemo(() => {
    const scale = Math.min(
      (viewport.width - 16) / canvasSize.width,
      (viewport.height - 16) / canvasSize.height,
    );
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }, [canvasSize.height, canvasSize.width, viewport.height, viewport.width]);

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

  const toCanvasPoint = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - stage.x()) / fit,
      y: (pointer.y - stage.y()) / fit,
    };
  };

  const createElementAtPoint = (x: number, y: number) => {
    if (activeTool === "text") {
      onPushHistory();
      onAddElement({
        id: uid(),
        type: "text",
        text: "Edit text",
        x,
        y,
        width: 360,
        fontSize: 54,
        fontFamily: "Inter",
        fontWeight: "600",
        fill: "#111827",
        align: "left",
        lineHeight: 1.25,
        letterSpacing: 0.2,
      });
      return;
    }
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
    const stage = evt.target.getStage();
    if (!stage) return;

    const clickedOnEmpty =
      evt.target === stage || evt.target.getParent() === stage;
    const point = toCanvasPoint(stage);
    if (!point) return;

    if (!clickedOnEmpty) return;

    if (activeTool !== "select") {
      createElementAtPoint(point.x, point.y);
      return;
    }

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

  const handleDragMove = (id: string, x: number, y: number) => {
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
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full bg-muted/20 overflow-hidden"
    >
      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        scale={{ x: fit, y: fit }}
        x={(viewport.width - canvasSize.width * fit) / 2}
        y={(viewport.height - canvasSize.height * fit) / 2}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          <Rect
            width={canvasSize.width}
            height={canvasSize.height}
            fill={backgroundColor}
          />

          {gridEnabled
            ? Array.from({ length: Math.floor(canvasSize.width / 40) }).map(
                (_, i) => (
                  <Line
                    key={`grid-v-${i}`}
                    points={[i * 40, 0, i * 40, canvasSize.height]}
                    stroke="rgba(148,163,184,0.22)"
                    strokeWidth={1}
                  />
                ),
              )
            : null}
          {gridEnabled
            ? Array.from({ length: Math.floor(canvasSize.height / 40) }).map(
                (_, i) => (
                  <Line
                    key={`grid-h-${i}`}
                    points={[0, i * 40, canvasSize.width, i * 40]}
                    stroke="rgba(148,163,184,0.22)"
                    strokeWidth={1}
                  />
                ),
              )
            : null}

          {elements.map((element) => (
            <SlideRenderer
              key={element.id}
              element={element}
              selected={selectedIds.includes(element.id)}
              onSelect={onSelect}
              onChange={onChangeElement}
              onDragMove={handleDragMove}
              onDragEnd={() => setGuides({ x: null, y: null })}
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

          {guides.x !== null ? (
            <Line
              points={[guides.x, 0, guides.x, canvasSize.height]}
              stroke="#22C55E"
              strokeWidth={1}
              dash={[6, 6]}
            />
          ) : null}
          {guides.y !== null ? (
            <Line
              points={[0, guides.y, canvasSize.width, guides.y]}
              stroke="#22C55E"
              strokeWidth={1}
              dash={[6, 6]}
            />
          ) : null}

          <KonvaTransformer
            stageRef={stageRef}
            selectedIds={selectedIds}
            elements={elements}
            onTransformEnd={onChangeElement}
          />
        </Layer>
      </Stage>

      {rulerEnabled ? (
        <>
          <div className="absolute top-0 left-6 right-0 h-6 bg-card/85 border-b border-border pointer-events-none" />
          <div className="absolute top-6 left-0 bottom-0 w-6 bg-card/85 border-r border-border pointer-events-none" />
        </>
      ) : null}
    </div>
  );
}
