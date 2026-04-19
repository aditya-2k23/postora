"use client";

import { useEffect, useMemo, useRef } from "react";
import type Konva from "konva";
import type { SlideElement } from "@/types/canvas";

type Props = {
  stage: Konva.Stage | null;
  editingElementId: string | null;
  elements: SlideElement[];
  onCommit: (nextValue: string) => void;
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

  const target = useMemo(
    () =>
      elements.find(
        (el): el is Extract<SlideElement, { type: "text" }> =>
          el.id === editingElementId && el.type === "text",
      ) ?? null,
    [editingElementId, elements],
  );

  const style = useMemo(() => {
    if (!stage || !target) return null;
    const node = stage.findOne<Konva.Text>(`#${target.id}`);
    if (!node) return null;
    const stageBox = stage.container().getBoundingClientRect();
    const abs = node.getAbsolutePosition();
    const scale = stage.scaleX() || 1;

    return {
      left: stageBox.left + abs.x * scale,
      top: stageBox.top + abs.y * scale,
      width: target.width * scale,
      minHeight: Math.max(target.fontSize * 1.5, node.height()) * scale,
      fontSize: target.fontSize * scale,
      lineHeight: target.lineHeight ?? 1.3,
      letterSpacing: target.letterSpacing ?? 0,
      color: target.fill,
      fontFamily: target.fontFamily,
      fontWeight: target.fontWeight ?? "400",
      textAlign: target.align ?? "left",
      transform: `rotate(${target.rotation ?? 0}deg)`,
      transformOrigin: "top left",
    } as const;
  }, [stage, target]);

  useEffect(() => {
    if (!editingElementId || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.select();
  }, [editingElementId]);

  if (!target || !style) return null;

  return (
    <textarea
      ref={textareaRef}
      defaultValue={target.text}
      onBlur={(evt) => onCommit(evt.target.value)}
      onKeyDown={(evt) => {
        if (evt.key === "Escape") {
          evt.preventDefault();
          onCancel();
          return;
        }
        if (evt.key === "Enter" && !evt.shiftKey) {
          evt.preventDefault();
          onCommit((evt.target as HTMLTextAreaElement).value);
        }
      }}
      className="fixed z-[120] border border-primary/40 bg-card/95 rounded-md p-1.5 outline-none shadow-lg resize-none"
      style={style}
    />
  );
}
