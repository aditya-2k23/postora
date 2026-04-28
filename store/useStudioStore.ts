import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/lib/idbStorage";

export type SocialCard = {
  id: string;
  title: string;
  content: string;
  imagePrompt?: string;
  imageUrl?: string;
};

export type ThemeSettings = {
  primaryColor: string;
  fontSize: number;
  style: string;
  layoutEngine: string;
  padding: number;
  roundness: number;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

/** Assistant-specific message (separate from generation chat) */
export type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
};

interface StudioState {
  prompt: string;
  tone: string;
  platform: string;
  aspectRatio: string;
  numCards: number;
  cards: SocialCard[];
  activeCardId: string | null;
  themeSettings: ThemeSettings;
  isGenerating: boolean;
  projectId: string | null;
  projectName: string | null;
  quotaRemaining: number | null;

  // Generation chat history (prompt → carousel)
  chatHistory: ChatMessage[];

  // Assistant chat history (post-generation coaching)
  assistantHistory: AssistantMessage[];
  isAssistantThinking: boolean;

  // Undo/Redo
  undoStack: SocialCard[][];
  redoStack: SocialCard[][];

  // Monotonically increasing counter to reliably detect state changes
  studioVersion: number;

  setPrompt: (prompt: string) => void;
  setTone: (tone: string) => void;
  setPlatform: (platform: string) => void;
  setAspectRatio: (aspectRatio: string) => void;
  setNumCards: (numCards: number) => void;
  setCards: (cards: SocialCard[]) => void;
  updateCard: (id: string, updates: Partial<SocialCard>) => void;
  moveCard: (activeId: string, overId: string) => void;
  setActiveCardId: (id: string | null) => void;
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setProjectId: (id: string | null) => void;
  setProjectName: (name: string | null) => void;
  setQuotaRemaining: (val: number | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatHistory: (history: ChatMessage[]) => void;
  addAssistantMessage: (message: AssistantMessage) => void;
  setAssistantHistory: (history: AssistantMessage[]) => void;
  setIsAssistantThinking: (v: boolean) => void;
  clearAssistantHistory: () => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const defaultTheme: ThemeSettings = {
  primaryColor: "#6366F1",
  fontSize: 16,
  style: "minimal",
  layoutEngine: "standard",
  padding: 40,
  roundness: 16,
};

const MAX_PERSISTED_DATA_URL_LENGTH = 12_000;
const UNDO_STACK_LIMIT = 100;

const sanitizePersistedCards = (cards: SocialCard[]): SocialCard[] =>
  cards.map((card) => {
    const imageUrl = card.imageUrl;
    if (
      typeof imageUrl === "string" &&
      imageUrl.startsWith("data:") &&
      imageUrl.length > MAX_PERSISTED_DATA_URL_LENGTH
    ) {
      const { imageUrl: _removed, ...rest } = card;
      return rest;
    }

    return card;
  });

const truncateArray = <T>(arr: T[], limit: number): T[] => {
  return arr.length > limit ? arr.slice(-limit) : arr;
};

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      prompt: "",
      tone: "Professional",
      platform: "Instagram Carousel",
      aspectRatio: "4:5",
      numCards: 5,
      cards: [
        {
          id: "default-slide-1",
          title: "Slide 1",
          content: "Add your text here...",
        }
      ],
      activeCardId: "default-slide-1",
      themeSettings: defaultTheme,
      isGenerating: false,
      projectId: null,
      projectName: null,
      quotaRemaining: null,
      chatHistory: [],
      assistantHistory: [],
      isAssistantThinking: false,
      undoStack: [],
      redoStack: [],
      studioVersion: 0,

      setPrompt: (prompt) => set({ prompt }),
      setTone: (tone) => set({ tone }),
      setPlatform: (platform) => set({ platform }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setNumCards: (numCards) => set({ numCards }),
      setCards: (cards) => set({ cards }),
      updateCard: (id, updates) =>
        set((state) => ({
          cards: state.cards.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),
      moveCard: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.cards.findIndex((c) => c.id === activeId);
          const newIndex = state.cards.findIndex((c) => c.id === overId);
          if (oldIndex === -1 || newIndex === -1) return state;
          const newCards = [...state.cards];
          const [moved] = newCards.splice(oldIndex, 1);
          newCards.splice(newIndex, 0, moved);
          return { cards: newCards };
        }),
      setActiveCardId: (activeCardId) =>
        set((state) => {
          if (state.activeCardId === activeCardId) return state;
          return { activeCardId };
        }),
      updateTheme: (updates) =>
        set((state) => ({
          themeSettings: { ...state.themeSettings, ...updates },
        })),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setProjectId: (projectId) => set({ projectId }),
      setProjectName: (projectName) => set({ projectName }),
      setQuotaRemaining: (quotaRemaining) => set({ quotaRemaining }),

      addChatMessage: (message) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, message],
          studioVersion: state.studioVersion + 1,
        })),
      setChatHistory: (chatHistory) => set((state) => ({ chatHistory, studioVersion: state.studioVersion + 1 })),

      addAssistantMessage: (message) =>
        set((state) => ({
          assistantHistory: [...state.assistantHistory, message],
          studioVersion: state.studioVersion + 1,
        })),
      setAssistantHistory: (assistantHistory) => set((state) => ({ assistantHistory, studioVersion: state.studioVersion + 1 })),

      setIsAssistantThinking: (isAssistantThinking) =>
        set({ isAssistantThinking }),

      clearAssistantHistory: () => set({ assistantHistory: [] }),

      pushUndo: () =>
        set((state) => ({
          undoStack: [...state.undoStack, structuredClone(state.cards)].slice(
            -UNDO_STACK_LIMIT,
          ),
          redoStack: [],
        })),

      undo: () =>
        set((state) => {
          if (state.undoStack.length === 0) return state;
          const newUndo = [...state.undoStack];
          const prev = newUndo.pop()!;
          return {
            undoStack: newUndo,
            redoStack: [...state.redoStack, structuredClone(state.cards)],
            cards: prev,
            activeCardId: prev.length > 0 ? prev[0].id : null,
          };
        }),

      redo: () =>
        set((state) => {
          if (state.redoStack.length === 0) return state;
          const newRedo = [...state.redoStack];
          const next = newRedo.pop()!;
          return {
            redoStack: newRedo,
            undoStack: [...state.undoStack, structuredClone(state.cards)].slice(
              -UNDO_STACK_LIMIT,
            ),
            cards: next,
            activeCardId: next.length > 0 ? next[0].id : null,
          };
        }),

      reset: () => {
        const defaultCardId = crypto.randomUUID();
        set({
          prompt: "",
          cards: [{
            id: defaultCardId,
            title: "Slide 1",
            content: "Add your text here...",
          }],
          activeCardId: defaultCardId,
          projectId: null,
          projectName: null,
          quotaRemaining: null,
          chatHistory: [],
          assistantHistory: [],
          isAssistantThinking: false,
          undoStack: [],
          redoStack: [],
          studioVersion: 0,
        });
      },
    }),
    {
      name: "social-studio-storage",
      partialize: (state) => ({
        studioVersion: state.studioVersion,
        projectId: state.projectId,
        projectName: state.projectName,
        prompt: state.prompt,
        tone: state.tone,
        platform: state.platform,
        aspectRatio: state.aspectRatio,
        numCards: state.numCards,
        cards: sanitizePersistedCards(state.cards),
        themeSettings: state.themeSettings,
        chatHistory: truncateArray(state.chatHistory, UNDO_STACK_LIMIT),
        assistantHistory: truncateArray(state.assistantHistory, UNDO_STACK_LIMIT),
      }),
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
