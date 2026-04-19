import { create } from "zustand";
import { persist } from "zustand/middleware";

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
};

export type ChatMessage = {
  role: "user" | "ai";
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

  // Chat history
  chatHistory: ChatMessage[];

  // Undo/Redo
  undoStack: SocialCard[][];
  redoStack: SocialCard[][];

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
  addChatMessage: (message: ChatMessage) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const defaultTheme: ThemeSettings = {
  primaryColor: "#2563EB",
  fontSize: 16,
  style: "minimal",
};

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      prompt: "",
      tone: "Professional",
      platform: "Instagram Carousel",
      aspectRatio: "4:5",
      numCards: 5,
      cards: [],
      activeCardId: null,
      themeSettings: defaultTheme,
      isGenerating: false,
      projectId: null,
      chatHistory: [],
      undoStack: [],
      redoStack: [],

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
      setActiveCardId: (activeCardId) => set({ activeCardId }),
      updateTheme: (updates) =>
        set((state) => ({
          themeSettings: { ...state.themeSettings, ...updates },
        })),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setProjectId: (projectId) => set({ projectId }),

      addChatMessage: (message) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, message],
        })),

      pushUndo: () =>
        set((state) => ({
          undoStack: [...state.undoStack, structuredClone(state.cards)],
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
            undoStack: [...state.undoStack, structuredClone(state.cards)],
            cards: next,
            activeCardId: next.length > 0 ? next[0].id : null,
          };
        }),

      reset: () =>
        set({
          prompt: "",
          cards: [],
          activeCardId: null,
          projectId: null,
          chatHistory: [],
          undoStack: [],
          redoStack: [],
        }),
    }),
    {
      name: "social-studio-storage",
      partialize: (state) => ({
        prompt: state.prompt,
        tone: state.tone,
        platform: state.platform,
        aspectRatio: state.aspectRatio,
        numCards: state.numCards,
        cards: state.cards,
        themeSettings: state.themeSettings,
        chatHistory: state.chatHistory,
      }),
    },
  ),
);
