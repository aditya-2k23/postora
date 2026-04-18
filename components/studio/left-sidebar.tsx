"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

const TONES = ["Professional", "Friendly", "Bold", "Parent-Focused", "Humorous", "Educational"];
const PLATFORMS = ["Instagram Carousel", "Instagram Post", "Instagram Story", "LinkedIn Post", "X/Twitter Graphic", "TikTok Cover"];
const FORMATS = [
  { value: "1:1", label: "1:1 Square" },
  { value: "4:5", label: "4:5 Portrait" },
  { value: "9:16", label: "9:16 Story/Reel" },
  { value: "16:9", label: "16:9 Landscape" }
];

export function LeftSidebar() {
  const { 
    prompt, setPrompt, 
    tone, setTone, 
    platform, setPlatform, 
    aspectRatio, setAspectRatio, 
    numCards, setNumCards, 
    setCards, setActiveCardId,
    isGenerating, setIsGenerating
  } = useStudioStore();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt idea first.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, tone, platform, aspectRatio, numCards })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      
      const generatedCards = data.cards.map((c: any) => ({
        id: crypto.randomUUID(),
        ...c,
      }));
      
      setCards(generatedCards);
      if (generatedCards.length > 0) setActiveCardId(generatedCards[0].id);
      toast.success("Content generated successfully!");
      
      // Kick off background tasks to generate images for each card
      generatedCards.forEach((c: any) => {
        generateImageForCard(c.id, c.imagePrompt, aspectRatio);
      });
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImageForCard = async (cardId: string, imagePrompt: string, ratio: string) => {
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, aspectRatio: ratio })
      });
      const data = await res.json();
      if (!res.ok) return; // Silent fail for async images
      
      useStudioStore.getState().updateCard(cardId, { imageUrl: data.imageUrl });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full md:w-80 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col h-full overflow-y-auto z-10 shrink-0">
      <div className="flex items-center gap-2 mb-8">
        <div className="bg-blue-600 p-1.5 rounded-lg text-white">
          <Wand2 className="w-5 h-5" />
        </div>
        <h2 className="font-bold text-lg tracking-tight">Studio</h2>
      </div>

      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <Label>Prompt Idea</Label>
          <Textarea 
            placeholder="e.g. Carousel for parents about why kids forget what they learn..."
            className="min-h-[120px] resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Tone</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Number of Cards</Label>
            <span className="text-sm font-medium">{numCards}</span>
          </div>
          <Slider 
            value={[numCards]} 
            min={1} max={12} step={1}
            onValueChange={(val) => setNumCards(val[0])}
          />
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-100 dark:border-zinc-800">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base shadow-lg shadow-blue-500/20" 
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Wand2 className="w-5 h-5 mr-2" />}
          {isGenerating ? "Generating..." : "Generate Content"}
        </Button>
      </div>
    </div>
  );
}
