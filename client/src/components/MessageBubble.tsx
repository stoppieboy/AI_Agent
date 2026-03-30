import { useState, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '../types';

function CodeBlock({ children }: { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = preRef.current?.querySelector('code')?.innerText ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-block-wrap">
      <pre ref={preRef}>{children}</pre>
      <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

const mdComponents = {
  pre: ({ children }: { children?: React.ReactNode }) => <CodeBlock>{children}</CodeBlock>,
};

export function MessageBubble({ message }: { message: Message }) {
  const [msgCopied, setMsgCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setMsgCopied(true);
      setTimeout(() => setMsgCopied(false), 2000);
    });
  };

  return (
    <div className={`msg-row ${message.role}`}>
      <div className={`avatar ${isUser ? 'user-av' : 'ai-av'}`} aria-hidden="true">
        {isUser ? '🧑' : '✦'}
      </div>

      <div className="bubble">
        {/* Tool activity pills (agent mode only) */}
        {message.toolPills?.map((pill, i) => (
          <div key={i} className="tool-pill">
            {!pill.resolved && <div className="tool-spinner" aria-hidden="true" />}
            <span>
              {pill.resolved ? '✓ Used ' : 'Using '}
              <strong>{pill.name}</strong>
              {!pill.resolved && '…'}
            </span>
          </div>
        ))}

        {/* Message content */}
        <div className="bubble-content">
          {isUser ? (
            // User messages rendered as plain text (safe by default in JSX)
            message.content
          ) : (
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={mdComponents as never}
            >
              {message.content}
            </Markdown>
          )}
        </div>

        {/* Blinking cursor while streaming */}
        {message.streaming && <span className="cursor" aria-hidden="true" />}

        {/* Copy button for assistant messages */}
        {!isUser && !message.streaming && (
          <button
            className={`msg-copy-btn${msgCopied ? ' copied' : ''}`}
            aria-label="Copy message"
            onClick={copyMessage}
          >
            {msgCopied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
