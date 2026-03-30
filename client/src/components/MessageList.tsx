import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { MessageBubble } from './MessageBubble';

const SUGGESTIONS = [
  'What time is it?',
  'What files are in this workspace?',
  'Ingest documents into knowledge base',
  'What do you know about me?',
];

interface Props {
  onSend: (text: string) => void;
}

export function MessageList({ onSend }: Props) {
  const messages = useAppStore((s) => s.messages);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Scroll when a new message is added
  const lastMsgId = messages.at(-1)?.id;
  useEffect(() => {
    scrollToBottom('smooth');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsgId]);

  // Follow the stream if user is already near the bottom
  const lastMsgContent = messages.at(-1)?.content ?? '';
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom('smooth');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsgContent]);

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom && el.scrollHeight > el.clientHeight);
  }

  return (
    <>
      <div
        id="messages"
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        onScroll={onScroll}
      >
        {messages.length === 0 ? (
          <div id="empty-state">
            <div className="icon" aria-hidden="true">✦</div>
            <h2>How can I help?</h2>
            <p>Ask me anything. I can use tools, remember things, and search documents.</p>
            <div className="suggestions" role="list">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="suggestion-chip"
                  role="listitem"
                  onClick={() => onSend(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      <button
        id="scroll-btn"
        className={showScrollBtn ? 'show' : ''}
        aria-label="Scroll to latest message"
        title="Scroll to bottom"
        onClick={() => scrollToBottom('smooth')}
      >
        ↓ Latest
      </button>
    </>
  );
}
