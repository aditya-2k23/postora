"use client";

import { useStudioStore, SocialCard } from "@/store/useStudioStore";
import { ChevronLeft, ChevronRight, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import TextareaAutosize from 'react-textarea-autosize'; // Need to install
import { motion, AnimatePresence } from "motion/react";

function SortableThumbnail({ card, isActive, onClick, aspectRatio }: { card: SocialCard, isActive: boolean, onClick: () => void, aspectRatio: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [aspectW, aspectH] = aspectRatio.split(':').map(Number);
  const ratio = aspectW / aspectH;
  
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`h-16 shrink-0 cursor-pointer rounded-md overflow-hidden border-2 transition-colors ${isActive ? 'border-primary' : 'border-transparent'} relative`}
      style={{ aspectRatio: ratio || 1, ...style }}
    >
      {card.imageUrl ? (
        <img src={card.imageUrl} alt="thumbnail" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800" />
      )}
      <div className="absolute inset-0 bg-black/20" />
      <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white drop-shadow-md">
        {card.title.slice(0, 10)}
      </span>
    </div>
  );
}

export function CenterCanvas() {
  const { cards, activeCardId, setActiveCardId, setCards, aspectRatio, themeSettings, updateCard } = useStudioStore();

  const activeIndex = cards.findIndex(c => c.id === activeCardId);
  const activeCard = cards[activeIndex];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cards.findIndex(c => c.id === active.id);
      const newIndex = cards.findIndex(c => c.id === over.id);
      setCards(arrayMove(cards, oldIndex, newIndex));
    }
  };

  const getAspectPadding = () => {
    if (aspectRatio === '1:1') return 'pb-[100%]';
    if (aspectRatio === '4:5') return 'pb-[125%]';
    if (aspectRatio === '9:16') return 'pb-[177.77%]';
    if (aspectRatio === '16:9') return 'pb-[56.25%]';
    return 'pb-[100%]';
  };

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100/50 dark:bg-zinc-950/50">
        <LayoutTemplate className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-xl font-medium text-gray-500">Your content will appear here</h3>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 md:p-8 overflow-hidden relative">
      
      {/* Navigation */}
      <div className="flex items-center gap-4 w-full justify-center mb-4 shrink-0">
        <Button variant="outline" size="icon" onClick={() => setActiveCardId(cards[Math.max(0, activeIndex - 1)].id)} disabled={activeIndex === 0}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-sm font-medium">{activeIndex + 1} of {cards.length}</span>
        <Button variant="outline" size="icon" onClick={() => setActiveCardId(cards[Math.min(cards.length - 1, activeIndex + 1)].id)} disabled={activeIndex === cards.length - 1}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Main Canvas Container - responsive scaling */}
      <div className="w-full flex-1 max-h-[70vh] flex justify-center items-center relative z-10 w-full overflow-hidden">
        
        {/* Hidden Export Container: All cards rendered side by side to ensure exact size capture without UI scaling issues */}
        <div className="absolute top-0 left-[-9999px] flex gap-4 w-max">
            {cards.map(c => {
              const [w, h] = aspectRatio.split(':').map(Number);
              const ratio = w / h;
              return (
              <div 
                key={"export-"+c.id}
                className="export-card bg-white relative overflow-hidden" 
                style={{ 
                  width: '1080px', 
                  height: `${1080 / ratio}px`,
                  fontFamily: 'var(--font-sans)',
                  backgroundColor: themeSettings.style === 'bold' ? themeSettings.primaryColor : '#ffffff',
                  color: themeSettings.style === 'bold' ? '#ffffff' : '#111827'
                }}
              >
                  {/* Similar rendering to actual card */}
                  {c.imageUrl && <img src={c.imageUrl} className={`absolute inset-0 w-full h-full object-cover ${themeSettings.style === 'minimal' ? 'opacity-20' : 'opacity-40'}`} />}
                  <div className="absolute inset-0 flex flex-col justify-center p-20 z-10 text-center">
                      <h2 className="font-bold tracking-tight mb-8" style={{ fontSize: `${themeSettings.fontSize * 3}px` }}>{c.title}</h2>
                      <p className="opacity-90 leading-relaxed" style={{ fontSize: `${themeSettings.fontSize * 1.5}px` }}>{c.content}</p>
                  </div>
              </div>
            )})}
        </div>

        <AnimatePresence mode="wait">
          {activeCard && (
            <motion.div
              key={activeCard.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm shrink-0 flex items-center justify-center h-full max-h-full aspect-auto"
            >
              <div className="relative w-full bg-white dark:bg-zinc-900 shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800"
                   style={{ 
                      aspectRatio: aspectRatio.replace(':', '/'),
                      backgroundColor: themeSettings.style === 'bold' ? themeSettings.primaryColor : undefined,
                      color: themeSettings.style === 'bold' ? '#ffffff' : undefined
                   }}>
                {/* Background Image */}
                {activeCard.imageUrl && (
                  <img src={activeCard.imageUrl} alt="" className={`absolute inset-0 w-full h-full object-cover ${themeSettings.style === 'minimal' ? 'opacity-20' : 'opacity-50 mix-blend-multiply'}`} />
                )}
                
                {/* Foreground Content */}
                <div className="absolute inset-0 p-8 flex flex-col justify-center text-center z-10 w-full h-full"> 
                  <TextareaAutosize
                    value={activeCard.title}
                    onChange={(e) => updateCard(activeCard.id, { title: e.target.value })}
                    className="w-full text-center font-bold tracking-tight bg-transparent border-none resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded p-2 text-balance leading-tight"
                    style={{ fontSize: `${themeSettings.fontSize * 1.5}px` }}
                  />
                  <TextareaAutosize
                    value={activeCard.content}
                    onChange={(e) => updateCard(activeCard.id, { content: e.target.value })}
                    className="w-full text-center mt-4 bg-transparent border-none resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded p-2 opacity-90 leading-relaxed"
                    style={{ fontSize: `${themeSettings.fontSize}px` }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Thumbnails */}
      <div className="w-full mt-6 shrink-0 z-20">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cards.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-2 overflow-x-auto p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 items-center max-w-full">
              {cards.map(c => (
                <SortableThumbnail 
                  key={c.id} 
                  card={c} 
                  isActive={activeCardId === c.id} 
                  onClick={() => setActiveCardId(c.id)}
                  aspectRatio={aspectRatio}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

    </div>
  );
}
