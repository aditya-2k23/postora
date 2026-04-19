"use client";

import { useStudioStore, SocialCard } from "@/store/useStudioStore";
import { getAccessibleTextColor } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Undo2,
  Redo2,
  Type,
  Image,
  Shapes,
  LayoutGrid,
  Component,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "motion/react";

const TOOLBAR_ITEMS = [
  { icon: Type, label: "Text" },
  { icon: Image, label: "Images\n(AI Regen)" },
  { icon: Shapes, label: "Shapes" },
  { icon: LayoutGrid, label: "Layouts" },
  { icon: Component, label: "Elements" },
];

export function CenterCanvas() {
  const {
    cards,
    activeCardId,
    setActiveCardId,
    aspectRatio,
    themeSettings,
    updateCard,
    undoStack,
    redoStack,
    undo,
    redo,
    pushUndo,
  } = useStudioStore();

  const activeIndex = cards.findIndex((c) => c.id === activeCardId);
  const activeCard = cards[activeIndex];

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background/50">
        <div className="text-center">
          <LayoutTemplate className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Your content will appear here
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use the AI Assistant to generate social media content
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Vertical Toolbar */}
      <div className="w-16 border-r border-border bg-card/50 flex flex-col items-center py-4 gap-1 shrink-0">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.label}
            className="w-12 h-14 flex flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title={item.label.replace("\n", " ")}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-[8px] leading-tight text-center whitespace-pre-line">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Controls: Undo/Redo + Slide nav */}
        <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-card/30 shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={undo}
              disabled={undoStack.length === 0}
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={redo}
              disabled={redoStack.length === 0}
            >
              <Redo2 className="w-3.5 h-3.5" />
              Redo
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Slide {activeIndex + 1} of {cards.length}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setActiveCardId(cards[Math.max(0, activeIndex - 1)].id)
                }
                disabled={activeIndex === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setActiveCardId(
                    cards[Math.min(cards.length - 1, activeIndex + 1)].id,
                  )
                }
                disabled={activeIndex === cards.length - 1}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas Preview */}
        <div className="flex-1 flex justify-center items-center p-6 overflow-hidden relative">
          {/* Hidden Export Container */}
          <div className="absolute top-0 left-[-9999px] flex gap-4 w-max">
            {cards.map((c) => {
              const [w, h] = aspectRatio.split(":").map(Number);
              const ratio = w / h;
              return (
                <div
                  key={"export-" + c.id}
                  className="export-card bg-white relative overflow-hidden"
                  style={{
                    width: "1080px",
                    height: `${1080 / ratio}px`,
                    fontFamily: "var(--font-sans)",
                    backgroundColor:
                      themeSettings.style === "bold"
                        ? themeSettings.primaryColor
                        : "#ffffff",
                    color:
                      themeSettings.style === "bold"
                        ? getAccessibleTextColor(themeSettings.primaryColor)
                        : "#111827",
                  }}
                >
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      className={`absolute inset-0 w-full h-full object-cover ${themeSettings.style === "minimal" ? "opacity-20" : "opacity-40"}`}
                    />
                  )}
                  <div
                    className={`absolute inset-0 flex z-10 ${
                      themeSettings.layoutEngine === "split" ? "flex-row items-center gap-12" : "flex-col gap-8"
                    } ${
                      themeSettings.layoutEngine === "inverted" ? "justify-end pb-32" : "justify-center"
                    }`}
                    style={{ padding: `${themeSettings.padding * 2.5}px` }}
                  >
                    {themeSettings.layoutEngine === "inverted" ? (
                      <>
                        <p
                          className="opacity-90 leading-relaxed text-left"
                          style={{ fontSize: `${themeSettings.fontSize * 1.5}px` }}
                        >
                          {c.content}
                        </p>
                        <h2
                          className="font-bold tracking-tight text-center"
                          style={{ fontSize: `${themeSettings.fontSize * 3}px` }}
                        >
                          {c.title}
                        </h2>
                      </>
                    ) : (
                      <>
                        <h2
                          className={`font-bold tracking-tight ${themeSettings.layoutEngine === "split" ? "flex-1" : ""} ${themeSettings.layoutEngine === "split" ? "text-left" : "text-center"}`}
                          style={{ fontSize: `${themeSettings.fontSize * 3}px` }}
                        >
                          {c.title}
                        </h2>
                        <p
                          className={`opacity-90 leading-relaxed ${themeSettings.layoutEngine === "split" ? "flex-1" : ""} text-left`}
                          style={{ fontSize: `${themeSettings.fontSize * 1.5}px` }}
                        >
                          {c.content}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Card Preview */}
          <AnimatePresence mode="wait">
            {activeCard && (
              <motion.div
                key={activeCard.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md flex items-center justify-center"
              >
                <div
                  className="relative w-full bg-card shadow-2xl overflow-hidden border border-border"
                  style={{
                    aspectRatio: aspectRatio.replace(":", "/"),
                    borderRadius: `${themeSettings.roundness}px`,
                    backgroundColor:
                      themeSettings.style === "bold"
                        ? themeSettings.primaryColor
                        : undefined,
                    color:
                      themeSettings.style === "bold"
                        ? getAccessibleTextColor(themeSettings.primaryColor)
                        : undefined,
                  }}
                >
                  {/* Background Image */}
                  {activeCard.imageUrl && (
                    <img
                      src={activeCard.imageUrl}
                      alt=""
                      className={`absolute inset-0 w-full h-full object-cover ${themeSettings.style === "minimal" ? "opacity-20" : "opacity-50 mix-blend-multiply"}`}
                    />
                  )}

                  {/* Foreground Content */}
                  <div
                    className={`absolute inset-0 flex z-10 w-full h-full ${
                      themeSettings.layoutEngine === "split" ? "flex-row items-center gap-6" : "flex-col gap-4"
                    } ${
                      themeSettings.layoutEngine === "inverted" ? "justify-end pb-12" : "justify-center"
                    }`}
                    style={{ padding: `${themeSettings.padding}px` }}
                  >
                    {themeSettings.layoutEngine === "inverted" ? (
                      <>
                        <TextareaAutosize
                          value={activeCard.content}
                          onChange={(e) => {
                            pushUndo();
                            updateCard(activeCard.id, { content: e.target.value });
                          }}
                          className="w-full text-left bg-transparent border-none resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 rounded p-2 opacity-90 leading-relaxed"
                          style={{ fontSize: `${themeSettings.fontSize}px` }}
                        />
                        <TextareaAutosize
                          value={activeCard.title}
                          onChange={(e) => {
                            pushUndo();
                            updateCard(activeCard.id, { title: e.target.value });
                          }}
                          className="w-full font-bold tracking-tight bg-transparent border-none resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 rounded p-2 text-balance leading-tight text-center"
                          style={{ fontSize: `${themeSettings.fontSize * 1.5}px` }}
                        />
                      </>
                    ) : (
                      <>
                        <TextareaAutosize
                          value={activeCard.title}
                          onChange={(e) => {
                            pushUndo();
                            updateCard(activeCard.id, { title: e.target.value });
                          }}
                          className={`w-full font-bold tracking-tight bg-transparent border-none resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 rounded p-2 text-balance leading-tight ${themeSettings.layoutEngine === "split" ? "flex-1 text-left" : "text-center"}`}
                          style={{ fontSize: `${themeSettings.fontSize * 1.5}px` }}
                        />
                        <TextareaAutosize
                          value={activeCard.content}
                          onChange={(e) => {
                            pushUndo();
                            updateCard(activeCard.id, { content: e.target.value });
                          }}
                          className={`w-full text-left bg-transparent border-none resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 rounded p-2 opacity-90 leading-relaxed ${themeSettings.layoutEngine === "split" ? "flex-1" : ""}`}
                          style={{ fontSize: `${themeSettings.fontSize}px` }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
