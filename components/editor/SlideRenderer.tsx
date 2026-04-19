"use client";

import { memo } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
} from "react-konva/lib/ReactKonvaCore";
import "@/lib/konva-shapes";
import useImage from "use-image";
import type { SlideElement } from "@/types/canvas";

type Props = {
  element: SlideElement;
  selected: boolean;
  isSelectMode: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onChange: (id: string, updates: Partial<SlideElement>) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onDoubleClickText?: (id: string) => void;
};

const ImageNode = memo(function ImageNode({
  element,
  isSelectMode,
  selected,
  onSelect,
  onChange,
  onDragMove,
  onDragEnd,
}: Props & { element: Extract<SlideElement, { type: "image" }> }) {
  const [img] = useImage(element.src, "anonymous");
  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation ?? 0}
      opacity={element.opacity ?? 1}
      draggable={isSelectMode && !element.locked}
      visible={!element.hidden}
      onClick={(evt) => {
        if (!isSelectMode) return;
        onSelect(element.id, evt.evt.shiftKey);
      }}
      onTap={(evt) => {
        if (!isSelectMode) return;
        onSelect(element.id, evt.evt.shiftKey);
      }}
      onDragMove={(evt) =>
        onDragMove?.(element.id, evt.target.x(), evt.target.y())
      }
      onDragEnd={(evt) => {
        onChange(element.id, { x: evt.target.x(), y: evt.target.y() });
        onDragEnd?.(element.id, evt.target.x(), evt.target.y());
      }}
    >
      <Rect
        width={element.width}
        height={element.height}
        cornerRadius={element.cornerRadius ?? 0}
        fillEnabled={!img}
        fill={selected ? "rgba(59,130,246,0.12)" : "#E5E7EB"}
      />
      {img ? (
        <KonvaImage
          image={img}
          width={element.width}
          height={element.height}
          cornerRadius={element.cornerRadius ?? 0}
          crop={element.crop}
        />
      ) : null}
    </Group>
  );
});

const TextNode = memo(function TextNode({
  element,
  isSelectMode,
  onSelect,
  onChange,
  onDragMove,
  onDragEnd,
  onDoubleClickText,
}: Props & { element: Extract<SlideElement, { type: "text" }> }) {
  return (
    <Text
      id={element.id}
      text={element.text}
      x={element.x}
      y={element.y}
      width={element.width}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fontStyle={element.fontWeight?.includes("700") ? "bold" : "normal"}
      fill={element.fill}
      align={element.align}
      lineHeight={element.lineHeight}
      letterSpacing={element.letterSpacing}
      rotation={element.rotation ?? 0}
      opacity={element.opacity ?? 1}
      draggable={isSelectMode && !element.locked}
      visible={!element.hidden}
      onClick={(evt) => {
        if (!isSelectMode) return;
        onSelect(element.id, evt.evt.shiftKey);
      }}
      onTap={(evt) => {
        if (!isSelectMode) return;
        onSelect(element.id, evt.evt.shiftKey);
      }}
      onDblClick={() => {
        if (!isSelectMode) return;
        onDoubleClickText?.(element.id);
      }}
      onDblTap={() => {
        if (!isSelectMode) return;
        onDoubleClickText?.(element.id);
      }}
      onDragMove={(evt) =>
        onDragMove?.(element.id, evt.target.x(), evt.target.y())
      }
      onDragEnd={(evt) => {
        onChange(element.id, { x: evt.target.x(), y: evt.target.y() });
        onDragEnd?.(element.id, evt.target.x(), evt.target.y());
      }}
    />
  );
});

const ShapeNode = memo(function ShapeNode({
  element,
  isSelectMode,
  onSelect,
  onChange,
  onDragMove,
  onDragEnd,
}: Props & { element: Extract<SlideElement, { type: "shape" }> }) {
  if (element.shape === "line") {
    return (
      <Line
        id={element.id}
        points={[0, 0, element.width ?? 200, element.height ?? 0]}
        x={element.x}
        y={element.y}
        stroke={element.stroke ?? element.fill}
        strokeWidth={element.strokeWidth ?? 2}
        rotation={element.rotation ?? 0}
        opacity={element.opacity ?? 1}
        draggable={isSelectMode && !element.locked}
        visible={!element.hidden}
        onClick={(evt) => {
          if (!isSelectMode) return;
          onSelect(element.id, evt.evt.shiftKey);
        }}
        onTap={(evt) => {
          if (!isSelectMode) return;
          onSelect(element.id, evt.evt.shiftKey);
        }}
        onDragMove={(evt) =>
          onDragMove?.(element.id, evt.target.x(), evt.target.y())
        }
        onDragEnd={(evt) => {
          onChange(element.id, { x: evt.target.x(), y: evt.target.y() });
          onDragEnd?.(element.id, evt.target.x(), evt.target.y());
        }}
      />
    );
  }

  if (element.shape === "circle") {
    return (
      <Circle
        id={element.id}
        x={element.x + (element.radius ?? 40)}
        y={element.y + (element.radius ?? 40)}
        radius={element.radius ?? 40}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth ?? 0}
        rotation={element.rotation ?? 0}
        opacity={element.opacity ?? 1}
        draggable={isSelectMode && !element.locked}
        visible={!element.hidden}
        onClick={(evt) => {
          if (!isSelectMode) return;
          onSelect(element.id, evt.evt.shiftKey);
        }}
        onTap={(evt) => {
          if (!isSelectMode) return;
          onSelect(element.id, evt.evt.shiftKey);
        }}
        onDragMove={(evt) =>
          onDragMove?.(
            element.id,
            evt.target.x() - (element.radius ?? 40),
            evt.target.y() - (element.radius ?? 40),
          )
        }
        onDragEnd={(evt) => {
          const x = evt.target.x() - (element.radius ?? 40);
          const y = evt.target.y() - (element.radius ?? 40);
          onChange(element.id, { x, y });
          onDragEnd?.(element.id, x, y);
        }}
      />
    );
  }

  return (
    <Rect
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width ?? 120}
      height={element.height ?? 120}
      fill={element.fill}
      stroke={element.stroke}
      strokeWidth={element.strokeWidth ?? 0}
      cornerRadius={12}
      rotation={element.rotation ?? 0}
      opacity={element.opacity ?? 1}
      draggable={isSelectMode && !element.locked}
      visible={!element.hidden}
      onClick={(evt) => {
        if (!isSelectMode) return;
        onSelect(element.id, evt.evt.shiftKey);
      }}
      onTap={(evt) => {
        if (!isSelectMode) return;
        onSelect(element.id, evt.evt.shiftKey);
      }}
      onDragMove={(evt) =>
        onDragMove?.(element.id, evt.target.x(), evt.target.y())
      }
      onDragEnd={(evt) => {
        onChange(element.id, { x: evt.target.x(), y: evt.target.y() });
        onDragEnd?.(element.id, evt.target.x(), evt.target.y());
      }}
    />
  );
});

export const SlideRenderer = memo(function SlideRenderer(props: Props) {
  const { element } = props;
  if (element.type === "image")
    return <ImageNode {...props} element={element} />;
  if (element.type === "text") return <TextNode {...props} element={element} />;
  return <ShapeNode {...props} element={element} />;
});
