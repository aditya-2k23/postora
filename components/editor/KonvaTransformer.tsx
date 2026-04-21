"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Transformer } from "react-konva/lib/ReactKonvaCore";
import "@/lib/konva-shapes";
import type Konva from "konva";
import type { SlideElement } from "@/types/canvas";

type Props = {
  stageRef: RefObject<Konva.Stage | null>;
  selectedIds: string[];
  elements: SlideElement[];
  onTransformEnd: (elementId: string, updates: Partial<SlideElement>) => void;
};

export function KonvaTransformer({
  stageRef,
  selectedIds,
  elements,
  onTransformEnd,
}: Props) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [elements, selectedIds, stageRef]);

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled
      keepRatio={false}
      enabledAnchors={[
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ]}
      onTransformEnd={() => {
        const transformer = transformerRef.current;
        if (!transformer) return;
        transformer.nodes().forEach((node) => {
          const element = elements.find((el) => el.id === node.id());
          if (!element) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);

          if (element.type === "text") {
            onTransformEnd(element.id, {
              x: node.x(),
              y: node.y(),
              width: Math.max(50, node.width() * scaleX),
              fontSize: Math.max(10, element.fontSize * scaleY),
              rotation: node.rotation(),
            });
            return;
          }

          if (element.type === "image") {
            onTransformEnd(element.id, {
              x: node.x(),
              y: node.y(),
              width: Math.max(30, node.width() * scaleX),
              height: Math.max(30, node.height() * scaleY),
              rotation: node.rotation(),
            });
            return;
          }

          if (element.shape === "circle") {
            const newRadius = Math.max(
              8,
              (element.radius ?? 40) * Math.max(scaleX, scaleY),
            );
            onTransformEnd(element.id, {
              x: node.x() - newRadius,
              y: node.y() - newRadius,
              radius: newRadius,
              rotation: node.rotation(),
            });
            return;
          }

          onTransformEnd(element.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(8, (element.width ?? 120) * scaleX),
            height: Math.max(8, (element.height ?? 120) * scaleY),
            rotation: node.rotation(),
          });
        });
      }}
    />
  );
}
