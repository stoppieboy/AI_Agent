import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { stopChat } from '../hooks/useChat';

interface Props {
  onSend: (text: string) => void;
}

export function InputArea({ onSend }: Props) {
  const { busy, mode } = useAppStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function autoResize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleInput() {
    autoResize();
    setHasText(!!inputRef.current?.value.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    if (busy) {
      stopChat();
      return;
    }
    const el = inputRef.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text) return;
    el.value = '';
    el.style.height = 'auto';
    setHasText(false);
    onSend(text);
  }

  const hint =
    mode === 'agent'
      ? 'Agent mode uses tools, memory & RAG · Shift+Enter for newline'
      : 'Chat mode · direct model conversation · Shift+Enter for newline';

  return (
    <div id="input-area">
      <div id="input-wrap">
        <textarea
          ref={inputRef}
          id="user-input"
          rows={1}
          placeholder="Message AI Assistant… (Enter to send, Shift+Enter for newline)"
          aria-label="Message input"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button
          id="send-btn"
          className={busy ? 'stop' : ''}
          aria-label={busy ? 'Stop generating' : 'Send message'}
          disabled={!busy && !hasText}
          onClick={handleSend}
        >
          {!busy && (
            <svg
              className="send-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 8L14 2L10 8L14 14L2 8Z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      <p id="hint">{hint}</p>
    </div>
  );
}
