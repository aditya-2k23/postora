"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Button } from "@/components/ui/button";
import { Sparkles, MoreVertical, Send, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

const TONES = [
  "Professional",
  "Friendly",
  "Bold",
  "Parent-Focused",
  "Humorous",
  "Educational",
];
const PLATFORMS = [
  "Instagram Carousel",
  "Instagram Post",
  "Instagram Story",
  "LinkedIn Post",
  "X/Twitter Graphic",
  "TikTok Cover",
];

const QUICK_TEMPLATES = [
  {
    label: "Educational",
    prompt:
      "Create an educational carousel about a key learning concept with tips and insights",
  },
  {
    label: "Quote",
    prompt:
      "Design an inspiring quote post with a powerful message and clean layout",
  },
  {
    label: "How-To Guide",
    prompt:
      "Create a step-by-step how-to guide carousel with clear instructions",
  },
  {
    label: "Product Showcase",
    prompt:
      "Design a product showcase carousel highlighting key features and benefits",
  },
];

export function LeftSidebar() {
  const {
    setPrompt,
    tone,
    setTone,
    platform,
    setPlatform,
    aspectRatio,
    setAspectRatio,
    numCards,
    setNumCards,
    setCards,
    setActiveCardId,
    isGenerating,
    setIsGenerating,
    chatHistory,
    addChatMessage,
    pushUndo,
    themeSettings,
  } = useStudioStore();

  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) {
      toast.error("Please enter a prompt idea first.");
      return;
    }

    addChatMessage({ role: "user", text });
    setPrompt(text);
    setInputValue("");
    setIsGenerating(true);

    try {
      addChatMessage({
        role: "ai",
        text: `Drafting carousel based on "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"... Here are your slides.`,
      });

      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          tone,
          platform,
          aspectRatio,
          numCards,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");

      pushUndo();

      const generatedCards = data.cards.map((c: any) => ({
        id: crypto.randomUUID(),
        ...c,
      }));

      setCards(generatedCards);
      if (generatedCards.length > 0) setActiveCardId(generatedCards[0].id);
      toast.success("Content generated successfully!");

      // Background image generation
      generateImagesStaggered(generatedCards, aspectRatio);
    } catch (error: any) {
      addChatMessage({ role: "ai", text: `Error: ${error.message}` });
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImagesStaggered = async (
    cardsToProcess: any[],
    ratio: string,
  ) => {
    for (let i = 0; i < cardsToProcess.length; i++) {
      const c = cardsToProcess[i];
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: c.imagePrompt, aspectRatio: ratio }),
        });
        const data = await res.json();
        if (res.ok && data.imageUrl) {
          useStudioStore
            .getState()
            .updateCard(c.id, { imageUrl: data.imageUrl });
        }
      } catch (e) {
        console.error(`[Image ${i + 1}/${cardsToProcess.length}] failed:`, e);
      }

      // Wait 2s between requests to avoid rate limits
      if (i < cardsToProcess.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const accent = themeSettings.primaryColor;

  return (
    <div className="w-72 border-r border-border bg-card flex flex-col h-full shrink-0 z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-foreground">
            AI Assistant
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Generation Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-3 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tone</Label>
                  <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Platform</Label>
                  <Select
                    value={platform}
                    onValueChange={(v) => v && setPlatform(v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Aspect Ratio</Label>
                  <Select
                    value={aspectRatio}
                    onValueChange={(v) => v && setAspectRatio(v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1" className="text-xs">
                        1:1 Square
                      </SelectItem>
                      <SelectItem value="4:5" className="text-xs">
                        4:5 Portrait
                      </SelectItem>
                      <SelectItem value="9:16" className="text-xs">
                        9:16 Story
                      </SelectItem>
                      <SelectItem value="16:9" className="text-xs">
                        16:9 Landscape
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Cards</Label>
                    <span className="text-xs font-medium text-muted-foreground">
                      {numCards}
                    </span>
                  </div>
                  <Slider
                    value={[numCards]}
                    min={1}
                    max={12}
                    step={1}
                    onValueChange={(val) =>
                      setNumCards(Array.isArray(val) ? val[0] : val)
                    }
                  />
                </div>
              </div>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground">
              Describe your social media post idea and I&apos;ll generate it for
              you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "border"
                    : "bg-muted/50 border border-border"
                }`}
                style={
                  msg.role === "user"
                    ? {
                        backgroundColor: `${accent}15`,
                        borderColor: `${accent}30`,
                      }
                    : undefined
                }
              >
                <span
                  className="font-semibold text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: msg.role === "user" ? accent : undefined }}
                >
                  {msg.role === "user" ? "User" : "AI"}:
                </span>
                <span className="text-foreground/90">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 pb-6 border-t border-border space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <TextareaAutosize
              placeholder="Ask anything to create..."
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 text-foreground custom-scrollbar"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              minRows={1}
              maxRows={5}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={isGenerating || !inputValue.trim()}
            size="icon"
            className="h-[36px] w-[36px] shrink-0 shadow-sm text-white hover:opacity-90 rounded-lg mb-1"
            style={{ backgroundColor: accent }}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Quick Templates */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Quick Templates
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setInputValue(t.prompt)}
                className="text-[11px] px-2.5 py-1.5 rounded-md bg-muted/60 border border-border text-foreground/80 hover:bg-muted hover:text-foreground transition-colors text-left truncate"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
