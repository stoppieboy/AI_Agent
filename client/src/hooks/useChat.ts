import { useCallback, useRef } from 'react';
import { useAppStore, useConversationStore } from '../store';
import type { AgentEvent, Message } from '../types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Module-level abort controller so any component can stop the active stream.
let activeAbort: AbortController | null = null;

export function stopChat(): void {
  activeAbort?.abort();
  activeAbort = null;
  useAppStore.getState().setBusy(false);
}

function saveConversation(): void {
  const { messages } = useAppStore.getState();
  if (!messages.length) return;
  const { currentId, setCurrentId, upsertConversation } = useConversationStore.getState();
  const preview = messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'Conversation';
  const id = currentId ?? Date.now().toString();
  upsertConversation({
    id,
    preview,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    updatedAt: Date.now(),
  });
  if (!currentId) setCurrentId(id);
}

async function runAgentStream(
  serverUrl: string,
  userInput: string,
  history: { role: string; content: string }[],
  assistantId: string,
  signal: AbortSignal,
): Promise<void> {
  const { patchMessage } = useAppStore.getState();

  const res = await fetch(`${serverUrl}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput, history }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let event: AgentEvent;
        try {
          event = JSON.parse(line.slice(6)) as AgentEvent;
        } catch {
          continue;
        }

        if (event.type === 'tool') {
          patchMessage(assistantId, (m) => ({
            ...m,
            toolPills: [...(m.toolPills ?? []), { name: event.name, resolved: false }],
          }));
        } else if (event.type === 'token') {
          accText += event.content;
          patchMessage(assistantId, (m) => ({
            ...m,
            content: accText,
            toolPills: m.toolPills?.map((p) => ({ ...p, resolved: true })),
          }));
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function runChatStream(
  serverUrl: string,
  messages: { role: string; content: string }[],
  assistantId: string,
  signal: AbortSignal,
): Promise<void> {
  const { patchMessage } = useAppStore.getState();

  const res = await fetch(`${serverUrl}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let event: { token?: string; done?: boolean; error?: string };
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        if (event.token) {
          accText += event.token;
          patchMessage(assistantId, { content: accText });
        } else if (event.error) {
          throw new Error(event.error);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export function useChat(): { send: (text: string) => Promise<void> } {
  // Used only to ensure referential stability across re-renders.
  const sendRef = useRef<(text: string) => Promise<void>>();

  const send = useCallback(async (text: string): Promise<void> => {
    const { busy, messages, mode, serverUrl, appendMessage, patchMessage, setBusy, showToast } =
      useAppStore.getState();

    if (busy || !text.trim()) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text };
    const assistantId = uid();
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    appendMessage(userMsg);
    appendMessage({ id: assistantId, role: 'assistant', content: '', streaming: true, toolPills: [] });
    setBusy(true);

    activeAbort = new AbortController();
    const { signal } = activeAbort;

    try {
      if (mode === 'agent') {
        await runAgentStream(serverUrl, text, history, assistantId, signal);
      } else {
        await runChatStream(
          serverUrl,
          [...history, { role: 'user', content: text }],
          assistantId,
          signal,
        );
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'AbortError') {
        showToast(error.message || 'Something went wrong');
      }
    } finally {
      patchMessage(assistantId, { streaming: false });
      setBusy(false);
      activeAbort = null;
      saveConversation();
    }
  }, []);

  sendRef.current = send;
  return { send };
}
