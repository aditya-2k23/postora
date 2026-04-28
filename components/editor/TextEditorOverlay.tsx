"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const sessionIdRef = useRef<string | null>(null);
  const committedRef = useRef(false);
  const cancelledRef = useRef(false);

  const target = useMemo(
    () =>
      elements.find(
        (el): el is Extract<SlideElement, { type: "text" }> =>
          el.id === editingElementId && el.type === "text",
      ) ?? null,
    [editingElementId, elements],
  );

  const [draftValue, setDraftValue] = useState("");
  const draftRef = useRef(draftValue);

  // ── Core: whenever editingElementId changes, reset the session ──
  useEffect(() => {
    if (editingElementId !== sessionIdRef.current) {
      sessionIdRef.current = editingElementId;
      committedRef.current = false;
      cancelledRef.current = false;

      const initialText = target ? target.text : "";
      setDraftValue(initialText);
      draftRef.current = initialText;
    }
  }, [editingElementId, target]);

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

  // Auto-resize the textarea to fit its content so Shift+Enter newlines are visible,
  // and sync the height change to the underlying Konva Text node so the Transformer
  // (selection border / handles) follows along.
  const autoResize = useCallback(
    (nextText?: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      // Reset to 0 so scrollHeight reflects actual content height, not the old container
      ta.style.height = "0px";
      ta.style.height = `${ta.scrollHeight}px`;

      // Mirror the draft text onto the (invisible) Konva Text node so it
      // recalculates its intrinsic height and the Transformer follows.
      if (stage && sessionIdRef.current) {
        const konvaNode = stage.findOne<Konva.Text>(`#${sessionIdRef.current}`);
        if (konvaNode && nextText !== undefined) {
          konvaNode.text(nextText);
        }
        // Force the Transformer to re-measure its attached nodes
        const transformer = stage.findOne<Konva.Transformer>("Transformer");
        if (transformer) {
          transformer.forceUpdate();
          transformer.getLayer()?.batchDraw();
        }
      }
    },
    [stage],
  );

  // Focus + select + size whenever we enter a new editing session
  useEffect(() => {
    if (!editingElementId || !textareaRef.current) return;
    // Defer focus to the next frame so React has fully committed the DOM
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.select();
      autoResize();
    });
  }, [editingElementId, autoResize]);

  const handleCommit = useCallback(() => {
    // Guard: only commit once per session, and only for the correct element
    if (committedRef.current || cancelledRef.current) return;
    const id = sessionIdRef.current;
    if (!id) return;
    committedRef.current = true;
    onCommit(id, draftRef.current);
  }, [onCommit]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    onCancel();
  }, [onCancel]);

  if (!target || !style) return null;

  return (
    <textarea
      ref={textareaRef}
      value={draftValue}
      spellCheck={false}
      onChange={(evt) => {
        const val = evt.target.value;
        setDraftValue(val);
        draftRef.current = val;
        autoResize(val);
      }}
      onBlur={handleCommit}
      onKeyDown={(evt) => {
        if (evt.key === "Escape") {
          evt.preventDefault();
          handleCancel();
          return;
        }
        if (evt.key === "Enter" && !evt.shiftKey) {
          evt.preventDefault();
          handleCommit();
        }
      }}
      className="fixed z-[120] outline-none resize-none transition-opacity duration-100"
      style={style}
    />
  );
}
