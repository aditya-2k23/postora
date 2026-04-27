"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import type { SlideElement } from "@/types/canvas";

type Props = {
  stage: Konva.Stage | null;
  editingElementId: string | null;
  elements: SlideElement[];
  onCommit: (id: string, nextValue: string) => void;
  onCancel: () => void;
};

export function TextEditorOverlay({
  stage,
  editingElementId,
  elements,
  onCommit,
  onCancel,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didFinalizeRef = useRef(false);

  const target = useMemo(
    () =>
      elements.find(
        (el): el is Extract<SlideElement, { type: "text" }> =>
          el.id === editingElementId && el.type === "text",
      ) ?? null,
    [editingElementId, elements],
  );

  const [draftValue, setDraftValue] = useState(() => target?.text ?? "");

  useEffect(() => {
    didFinalizeRef.current = false;
  }, [editingElementId]);

  const style = useMemo(() => {
    if (!stage || !target) return null;
    const node = stage.findOne<Konva.Text>(`#${target.id}`);
    if (!node) return null;

    const stageBox = stage.container().getBoundingClientRect();
    const topLeft = node.getAbsoluteTransform().point({ x: 0, y: 0 });
    const absScale = node.getAbsoluteScale();
    const absRotation = node.getAbsoluteRotation();

    const scaleX = Math.max(absScale.x || 1, 0.0001);
    const scaleY = Math.max(absScale.y || 1, 0.0001);
    const computedHeight = Math.max(
      target.fontSize * (target.lineHeight ?? 1.3),
      node.height(),
    );

    return {
      left: stageBox.left + topLeft.x,
      top: stageBox.top + topLeft.y,
      width: node.width() * scaleX,
      minHeight: computedHeight * scaleY,
      fontSize: target.fontSize * scaleY,
      lineHeight: target.lineHeight ?? 1.3,
      letterSpacing: (target.letterSpacing ?? 0) * scaleX,
      color: target.fill,
      fontFamily: target.fontFamily,
      fontWeight: target.fontWeight ?? "400",
      textAlign: target.align ?? "left",
      transform: `rotate(${absRotation}deg)`,
      transformOrigin: "top left",
      padding: 0,
      margin: 0,
      background: "transparent",
      border: "none",
      boxShadow: "none",
      borderRadius: 0,
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      caretColor: target.fill,
    } as const;
  }, [stage, target]);

  useEffect(() => {
    if (!editingElementId || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.select();
  }, [editingElementId]);

  const finalizeCommit = () => {
    if (didFinalizeRef.current || !target) return;
    didFinalizeRef.current = true;
    onCommit(target.id, draftValue);
  };

  const finalizeCancel = () => {
    didFinalizeRef.current = true;
    onCancel();
  };

  if (!target || !style) return null;

  return (
    <textarea
      ref={textareaRef}
      value={draftValue}
      spellCheck={false}
      onChange={(evt) => {
        setDraftValue(evt.target.value);
      }}
      onBlur={finalizeCommit}
      onKeyDown={(evt) => {
        if (evt.key === "Escape") {
          evt.preventDefault();
          finalizeCancel();
          return;
        }
        if (evt.key === "Enter" && !evt.shiftKey) {
          evt.preventDefault();
          finalizeCommit();
        }
      }}
      className="fixed z-[120] outline-none resize-none transition-opacity duration-100"
      style={style}
    />
  );
}
