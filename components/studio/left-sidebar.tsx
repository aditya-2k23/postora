"use client";

import { useStudioStore, type SocialCard } from "@/store/useStudioStore";
import { useShallow } from "zustand/shallow";
import { getAccessibleTextColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
  Zap,
  LayoutTemplate,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
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
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

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
  const { user, loading } = useAuth();
  const router = useRouter();

  const {
    tone,
    platform,
    aspectRatio,
    numCards,
    isGenerating,
    chatHistory,
    assistantHistory,
    isAssistantThinking,
    themeSettings,
    quotaRemaining,
  } = useStudioStore(
    useShallow((s) => ({
      tone: s.tone,
      platform: s.platform,
      aspectRatio: s.aspectRatio,
      numCards: s.numCards,
      isGenerating: s.isGenerating,
      chatHistory: s.chatHistory,
      assistantHistory: s.assistantHistory,
      isAssistantThinking: s.isAssistantThinking,
      themeSettings: s.themeSettings,
      quotaRemaining: s.quotaRemaining,
    })),
  );

  const hasCards = useStudioStore((s) => s.cards.length > 0);

  const {
    setPrompt,
    setTone,
    setPlatform,
    setAspectRatio,
    setNumCards,
    setCards,
    setActiveCardId,
    setIsGenerating,
    addChatMessage,
    addAssistantMessage,
    setIsAssistantThinking,
    clearAssistantHistory,
    pushUndo,
    setQuotaRemaining,
  } = useStudioStore.getState();

  const [activeTab, setActiveTab] = useState<SidebarTab>("generate");
  const [inputValue, setInputValue] = useState("");
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);

  const requireAiToken = async () => {
    if (loading) {
      throw new Error("Checking sign-in status. Please try again in a moment.");
    }

    if (!user) {
      router.push("/login");
      throw new Error("Please sign in to use AI features.");
    }

    return user.getIdToken();
  };

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
    const { projectId, cards } = useStudioStore.getState();
    if (!projectId) {
      toast.error(
        "No active project. Please go to the Projects dashboard and create a new project first.",
        { duration: 5000 },
      );
      router.push("/projects");
      return;
    }

    const text = inputValue.trim();
    if (!text) {
      toast.error("Please enter a prompt idea first.");
      return;
    }

    let authToken = "";
    try {
      authToken = await requireAiToken();
    } catch (error: any) {
      toast.error(error.message);
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

      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          prompt: text,
          tone,
          platform,
          aspectRatio,
          numCards,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = { error: `Server error: ${res.statusText || res.status}` };
      }

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            data.errorType === "RateLimitExceeded"
              ? "Too many requests. Please slow down and try again."
              : "You've reached your daily AI limit. Thanks for using Postora! Please come back tomorrow for more.",
          );
        }
        throw new Error(data.error || "Failed to generate");
      }

      if (data.quotaRemaining !== undefined) {
        setQuotaRemaining(data.quotaRemaining);
      }

      pushUndo();

      const rawCards = Array.isArray(data?.cards)
        ? data.cards
        : Array.isArray(data)
          ? data
          : [];

      const generatedCards: SocialCard[] = rawCards
        .map((c: any) => ({
          id: crypto.randomUUID(),
          title: typeof c?.title === "string" ? c.title : "",
          content:
            typeof c?.content === "string"
              ? c.content
              : typeof c?.body === "string"
                ? c.body
                : "",
          imagePrompt: typeof c?.imagePrompt === "string" ? c.imagePrompt : "",
        }))
        .filter(
          (c: SocialCard) =>
            c.title.trim().length > 0 && c.content.trim().length > 0,
        );

      if (generatedCards.length === 0) {
        throw new Error(
          "Generator returned invalid cards format. Please try again.",
        );
      }

      if (cards.length > 0) {
        setCards([...cards, ...generatedCards]);
        addChatMessage({
          role: "ai",
          text: `Done! Appended ${generatedCards.length} new slides to your existing project. Switch to the Assistant tab for improvement suggestions.`,
        });
        toast.success(`Appended ${generatedCards.length} new slides!`);
      } else {
        setCards(generatedCards);
        addChatMessage({
          role: "ai",
          text: `Done! Generated ${generatedCards.length} slides. Switch to the Assistant tab for improvement suggestions.`,
        });
        toast.success("Content generated successfully!");
      }

      if (generatedCards.length > 0) setActiveCardId(generatedCards[0].id);
      setActiveTab("assistant");

      // Background image generation using the confirmed projectId
      generateImagesStaggered(
        generatedCards,
        aspectRatio,
        authToken,
        themeSettings.style,
        projectId,
      );

      // Auto-trigger initial assistant review
      triggerAutoReview(text, generatedCards, authToken);
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
    authToken: string,
    style: string,
    pId: string,
    regenerateNonce?: string,
  ) => {
    const sanitize = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_");

    for (let i = 0; i < cardsToProcess.length; i++) {
      const c = cardsToProcess[i];
      try {
        const rawKey = `img-${sanitize(c.id)}-${sanitize(pId)}-${sanitize(ratio)}-${sanitize(style)}${regenerateNonce ? `-${sanitize(regenerateNonce)}` : ""}`;
        const safeIdempotencyKey = rawKey.slice(0, 64);

        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            "x-idempotency-key": safeIdempotencyKey,
          },
          body: JSON.stringify({
            prompt: c.imagePrompt,
            aspectRatio: ratio,
            style,
            projectId: pId,
            cardId: c.id,
          }),
        });

        let data;
        try {
          data = await res.json();
        } catch (err) {
          data = { error: `Server error: ${res.statusText || res.status}` };
        }

        if (!res.ok) {
          const errorMsg =
            data.error || `Error ${res.status}: ${res.statusText}`;
          console.error(`[Image ${i + 1}] Generation failed:`, errorMsg);
          // Only toast first failure to avoid spamming 10+ toasts
          if (i === 0) {
            toast.error(`Image generation partially failed: ${errorMsg}`);
          }
          continue;
        }

        if (data.imageUrl) {
          useStudioStore
            .getState()
            .updateCard(c.id, { imageUrl: data.imageUrl });
          if (data.quotaRemaining !== undefined) {
            useStudioStore.getState().setQuotaRemaining(data.quotaRemaining);
          }
        }
      } catch (e: any) {
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
    authToken: string,
  ) => {
    setIsAssistantThinking(true);
    try {
      const res = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
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

      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = {};
      }

      if (res.ok && data.reply) {
        addAssistantMessage({ role: "assistant", text: data.reply });
        if (data.quotaRemaining !== undefined) {
          setQuotaRemaining(data.quotaRemaining);
        }
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
    const { cards, prompt } = useStudioStore.getState();
    if (cards.length === 0) {
      toast.error(
        "Generate a carousel first, then ask the assistant for help.",
      );
      return;
    }

    let authToken = "";
    try {
      authToken = await requireAiToken();
    } catch (error: any) {
      toast.error(error.message);
      return;
    }

    setIsAssistantThinking(true);

    try {
      // Build history for multi-turn (exclude the current message which is sent as 'message')
      const currentHistory = useStudioStore.getState().assistantHistory;
      const historyForApi = currentHistory.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      // Add to store for UI only after capturing history for API
      addAssistantMessage({ role: "user", text });
      setInputValue("");

      const res = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
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

      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = { error: `Server error: ${res.statusText || res.status}` };
      }

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            data.errorType === "RateLimitExceeded"
              ? "Too many requests. Please slow down and try again."
              : "You've reached your daily AI limit. Please come back tomorrow.",
          );
        }
        throw new Error(data.error || "Assistant failed");
      }

      if (data.quotaRemaining !== undefined) {
        setQuotaRemaining(data.quotaRemaining);
      }

      if (typeof data.reply === "string" && data.reply.trim()) {
        addAssistantMessage({ role: "assistant", text: data.reply });
      } else {
        throw new Error("Assistant returned an empty reply.");
      }
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
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Quick Templates"
          >
            <LayoutTemplate className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Quick Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {QUICK_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t.label}
                  onClick={() => setInputValue(t.prompt)}
                  className="text-xs cursor-pointer py-2 focus:bg-accent focus:text-foreground"
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 text-foreground transition-all shadow-sm min-h-[44px]"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  minRows={1}
                  maxRows={6}
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
            {quotaRemaining !== null && (
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>Daily AI Quota:</span>
                <span
                  className={`font-medium ${quotaRemaining === 0 ? "text-red-500" : "text-foreground"}`}
                >
                  {quotaRemaining} left
                </span>
              </div>
            )}

            {/* Generation Settings */}
            <div>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between group outline-none"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors mb-2">
                  Generation Settings
                </p>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 mb-2 ${
                    settingsExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  settingsExpanded
                    ? "grid-rows-[1fr] opacity-100 mb-2"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-border">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">
                        Tone
                      </Label>
                      <Select
                        value={tone}
                        onValueChange={(v) => v && setTone(v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-card">
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
                      <Label className="text-xs text-muted-foreground font-medium">
                        Platform
                      </Label>
                      <Select
                        value={platform}
                        onValueChange={(v) => v && setPlatform(v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-card">
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
                      <Label className="text-xs text-muted-foreground font-medium">
                        Aspect Ratio
                      </Label>
                      <Select
                        value={aspectRatio}
                        onValueChange={(v) => v && setAspectRatio(v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-card">
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
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs text-muted-foreground font-medium">
                          Cards
                        </Label>
                        <span className="text-[10px] font-medium text-foreground bg-accent/50 px-1.5 py-0.5 rounded">
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
                </div>
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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 text-foreground transition-all shadow-sm min-h-[44px]"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  minRows={1}
                  maxRows={6}
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
            {quotaRemaining !== null && (
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>Daily AI Quota:</span>
                <span
                  className={`font-medium ${quotaRemaining === 0 ? "text-red-500" : "text-foreground"}`}
                >
                  {quotaRemaining} left
                </span>
              </div>
            )}

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
