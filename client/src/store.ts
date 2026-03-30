import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conversation, Message, Mode } from './types';

// ── Conversation Store (persisted in localStorage) ──────────────────────────

interface ConversationState {
  conversations: Conversation[];
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  upsertConversation: (convo: Conversation) => void;
  deleteConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set) => ({
      conversations: [],
      currentId: null,
      setCurrentId: (currentId) => set({ currentId }),
      upsertConversation: (convo) =>
        set((state) => {
          const idx = state.conversations.findIndex((c) => c.id === convo.id);
          const updated =
            idx >= 0
              ? state.conversations.map((c) => (c.id === convo.id ? convo : c))
              : [convo, ...state.conversations].slice(0, 20);
          return { conversations: updated };
        }),
      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          currentId: state.currentId === id ? null : state.currentId,
        })),
    }),
    { name: 'ai-conversations', storage: createJSONStorage(() => localStorage) },
  ),
);

// ── App Store (messages are session-only; settings are persisted) ────────────

interface AppState {
  messages: Message[];
  mode: Mode;
  busy: boolean;
  toast: string | null;
  serverUrl: string;
  theme: 'dark' | 'light';
  setMessages: (messages: Message[]) => void;
  appendMessage: (msg: Message) => void;
  patchMessage: (id: string, patch: Partial<Message> | ((m: Message) => Message)) => void;
  setMode: (mode: Mode) => void;
  setBusy: (busy: boolean) => void;
  showToast: (msg: string) => void;
  hideToast: () => void;
  setServerUrl: (url: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      messages: [],
      mode: 'agent',
      busy: false,
      toast: null,
      serverUrl: 'http://localhost:3000',
      theme: 'dark',
      setMessages: (messages) => set({ messages }),
      appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      patchMessage: (id, patchOrFn) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id
              ? typeof patchOrFn === 'function'
                ? patchOrFn(m)
                : { ...m, ...patchOrFn }
              : m,
          ),
        })),
      setMode: (mode) => set({ mode }),
      setBusy: (busy) => set({ busy }),
      showToast: (toast) => set({ toast }),
      hideToast: () => set({ toast: null }),
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ai-app-settings',
      storage: createJSONStorage(() => localStorage),
      // Only persist user preferences, not transient state
      partialize: (s) => ({ mode: s.mode, serverUrl: s.serverUrl, theme: s.theme }),
    },
  ),
);
