import { useConversationStore, useAppStore } from '../store';
import type { StoredMessage, Message } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: Props) {
  const { conversations, currentId, setCurrentId, deleteConversation } = useConversationStore();
  const { setMessages, serverUrl, setServerUrl, theme, setTheme } = useAppStore();

  function loadConversation(id: string) {
    const convo = conversations.find((c) => c.id === id);
    if (!convo) return;
    setCurrentId(id);
    setMessages(
      convo.messages.map((m: StoredMessage, i: number): Message => ({
        id: String(i),
        role: m.role,
        content: m.content,
      })),
    );
    onClose();
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteConversation(id);
    if (currentId === id) setMessages([]);
  }

  function newChat() {
    setCurrentId(null);
    setMessages([]);
    onClose();
  }

  return (
    <nav id="sidebar" className={isOpen ? 'open' : ''} aria-label="Sidebar">
      <div className="sidebar-header">
        <div className="logo" aria-hidden="true">✦</div>
        <span className="sidebar-title">AI Assistant</span>
      </div>

      <div className="sidebar-actions">
        <button className="btn-new" onClick={newChat} aria-label="Start new conversation">
          <span aria-hidden="true">＋</span> New conversation
        </button>
      </div>

      <div className="sidebar-label">Conversations</div>
      <div id="convo-list" role="list" aria-label="Conversation history">
        {conversations.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            No saved conversations
          </div>
        ) : (
          conversations.map((convo) => (
            <div
              key={convo.id}
              className={`convo-item${convo.id === currentId ? ' active' : ''}`}
              role="listitem"
              tabIndex={0}
              aria-label={convo.preview}
              onClick={() => loadConversation(convo.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  loadConversation(convo.id);
                }
              }}
            >
              <span>{convo.preview}</span>
              <button
                className="convo-del"
                aria-label="Delete conversation"
                title="Delete"
                onClick={(e) => handleDelete(convo.id, e)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div id="settings-panel">
        <div className="settings-row">
          <label htmlFor="server-url">Server URL</label>
          <input
            id="server-url"
            type="url"
            value={serverUrl}
            spellCheck={false}
            onChange={(e) => setServerUrl(e.target.value)}
          />
        </div>
        <div className="theme-toggle">
          <label htmlFor="theme-switch">Light mode</label>
          <label className="switch">
            <input
              type="checkbox"
              id="theme-switch"
              role="switch"
              checked={theme === 'light'}
              aria-checked={theme === 'light'}
              onChange={(e) => setTheme(e.target.checked ? 'light' : 'dark')}
            />
            <span className="slider" />
          </label>
        </div>
      </div>
    </nav>
  );
}
