"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { getAccessibleTextColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  MoreVertical,
  Send,
  Loader2,
  MessageSquare,
  Zap,
} from "lucide-react";
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

const ASSISTANT_PROMPTS = [
  {
    label: "Review my post",
    prompt: "Review my carousel and suggest improvements.",
  },
  {
    label: "Stronger hook?",
    prompt: "How can I make the first slide hook stronger?",
  },
  {
    label: "Better CTA",
    prompt: "Suggest a more compelling call-to-action for my last slide.",
  },
  {
    label: "Add a slide?",
    prompt: "Should I add another slide? What should it cover?",
  },
];

// ─── Tab type ───
type SidebarTab = "generate" | "assistant";

export function LeftSidebar() {
  const {
    prompt,
    setPrompt,
    tone,
    setTone,
    platform,
    setPlatform,
    aspectRatio,
    setAspectRatio,
    numCards,
    setNumCards,
    cards,
    setCards,
    setActiveCardId,
    isGenerating,
    setIsGenerating,
    chatHistory,
    addChatMessage,
    assistantHistory,
    addAssistantMessage,
    isAssistantThinking,
    setIsAssistantThinking,
    clearAssistantHistory,
    pushUndo,
    themeSettings,
  } = useStudioStore();

  const [activeTab, setActiveTab] = useState<SidebarTab>("generate");
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Auto-scroll assistant
  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantHistory, isAssistantThinking]);

  // ─── Generation flow ───
  const handleGenerate = async () => {
    const text = inputValue.trim();
    if (!text) {
      toast.error("Please enter a prompt idea first.");
      return;
    }

    addChatMessage({ role: "user", text });
    setPrompt(text);
    setInputValue("");
    setIsGenerating(true);
    clearAssistantHistory();

    try {
      addChatMessage({
        role: "ai",
        text: `Drafting carousel based on "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"...`,
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

      addChatMessage({
        role: "ai",
        text: `Done! Generated ${generatedCards.length} slides. Switch to the Assistant tab for improvement suggestions.`,
      });
      setActiveTab("assistant");
      toast.success("Content generated successfully!");

      // Background image generation
      generateImagesStaggered(generatedCards, aspectRatio);

      // Auto-trigger initial assistant review
      triggerAutoReview(text, generatedCards);
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

      if (i < cardsToProcess.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  // ─── Auto-review after generation ───
  const triggerAutoReview = async (
    originalPrompt: string,
    generatedCards: any[],
  ) => {
    setIsAssistantThinking(true);
    try {
      const res = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "I just generated this carousel. Give me a quick review — what's working and what could be better?",
          context: {
            originalPrompt,
            cards: generatedCards,
            platform,
            tone,
            aspectRatio,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        addAssistantMessage({ role: "assistant", text: data.reply });
      }
    } catch (e) {
      console.error("[Auto-review] failed:", e);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  // ─── Assistant chat flow ───
  const handleAssistantSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    if (cards.length === 0) {
      toast.error(
        "Generate a carousel first, then ask the assistant for help.",
      );
      return;
    }

    addAssistantMessage({ role: "user", text });
    setInputValue("");
    setIsAssistantThinking(true);

    try {
      // Build history for multi-turn
      const currentHistory = useStudioStore.getState().assistantHistory;
      const historyForApi = currentHistory.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          context: {
            originalPrompt: prompt,
            cards: cards.map((c) => ({
              title: c.title,
              content: c.content,
            })),
            platform,
            tone,
            aspectRatio,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assistant failed");

      addAssistantMessage({ role: "assistant", text: data.reply });
    } catch (error: any) {
      addAssistantMessage({
        role: "assistant",
        text: `Sorry, I couldn't process that. ${error.message}`,
      });
      toast.error(error.message);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  // ─── Unified key handler ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (activeTab === "generate") handleGenerate();
      else handleAssistantSend();
    }
  };

  const handleSendClick = () => {
    if (activeTab === "generate") handleGenerate();
    else handleAssistantSend();
  };

  const accent = themeSettings.primaryColor;
  const hasCards = cards.length > 0;

  return (
    <div className="w-full h-full bg-card flex flex-col shrink-0 z-10 text-foreground overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
            style={{
              backgroundColor: accent,
              color: getAccessibleTextColor(accent),
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
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

      {/* Tab Switcher */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab("generate")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all ${
            activeTab === "generate"
              ? "text-foreground border-b-2"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={
            activeTab === "generate" ? { borderBottomColor: accent } : undefined
          }
        >
          <Zap className="w-3 h-3" />
          Generate
        </button>
        <button
          onClick={() => setActiveTab("assistant")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all relative ${
            activeTab === "assistant"
              ? "text-foreground border-b-2"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={
            activeTab === "assistant"
              ? { borderBottomColor: accent }
              : undefined
          }
        >
          <MessageSquare className="w-3 h-3" />
          Assistant
          {hasCards &&
            assistantHistory.length === 0 &&
            activeTab !== "assistant" && (
              <span
                className="absolute top-1.5 right-4 w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: accent }}
              />
            )}
        </button>
      </div>

      {/* GENERATE TAB */}
      {activeTab === "generate" && (
        <>
          {/* Generation Chat History */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-2">
                <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-xs text-muted-foreground">
                  Describe your social media post idea and I&apos;ll generate it
                  for you.
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
                      style={{
                        color: msg.role === "user" ? accent : undefined,
                      }}
                    >
                      {msg.role === "user" ? "You" : "Generator"}:
                    </span>
                    <span className="text-foreground/90">{msg.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Generation Input */}
          <div className="p-4 pb-6 border-t border-border space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <TextareaAutosize
                  placeholder="Describe your post idea..."
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 text-foreground"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  minRows={1}
                  maxRows={5}
                />
              </div>
              <Button
                onClick={handleSendClick}
                disabled={isGenerating || !inputValue.trim()}
                size="icon"
                className="h-[36px] w-[36px] shrink-0 shadow-sm hover:opacity-90 rounded-lg mb-1"
                style={{
                  backgroundColor: accent,
                  color: getAccessibleTextColor(accent),
                }}
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
        </>
      )}

      {/* ASSISTANT TAB */}
      {activeTab === "assistant" && (
        <>
          {/* Assistant Chat */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {!hasCards ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-2">
                <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-xs text-muted-foreground">
                  Generate a carousel first, then I&apos;ll help you improve it.
                </p>
              </div>
            ) : assistantHistory.length === 0 && !isAssistantThinking ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-2">
                <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-xs text-muted-foreground mb-3">
                  Your carousel is ready! Ask me anything about improving it.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assistantHistory.map((msg, i) => (
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
                      style={{
                        color: msg.role === "user" ? accent : undefined,
                      }}
                    >
                      {msg.role === "user" ? "You" : "Coach"}:
                    </span>
                    <span className="text-foreground/90 whitespace-pre-wrap">
                      {msg.text}
                    </span>
                  </div>
                ))}

                {/* Thinking indicator */}
                {isAssistantThinking && (
                  <div className="rounded-lg p-3 text-xs bg-muted/50 border border-border">
                    <span className="font-semibold text-[10px] uppercase tracking-wider block mb-1">
                      Coach:
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Reviewing your carousel...
                    </span>
                  </div>
                )}
                <div ref={assistantEndRef} />
              </div>
            )}
          </div>

          {/* Assistant Input */}
          <div className="p-4 pb-6 border-t border-border space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <TextareaAutosize
                  placeholder={
                    hasCards
                      ? "Ask about your carousel..."
                      : "Generate a carousel first..."
                  }
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 text-foreground"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  minRows={1}
                  maxRows={5}
                  disabled={!hasCards}
                />
              </div>
              <Button
                onClick={handleSendClick}
                disabled={
                  isAssistantThinking || !inputValue.trim() || !hasCards
                }
                size="icon"
                className="h-[36px] w-[36px] shrink-0 shadow-sm hover:opacity-90 rounded-lg mb-1"
                style={{
                  backgroundColor: accent,
                  color: getAccessibleTextColor(accent),
                }}
              >
                {isAssistantThinking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Quick Assistant Prompts */}
            {hasCards && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Quick Suggestions
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ASSISTANT_PROMPTS.map((t) => (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
