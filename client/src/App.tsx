import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MessageList } from './components/MessageList';
import { InputArea } from './components/InputArea';
import { Toast } from './components/Toast';
import { useHealth } from './hooks/useHealth';
import { useChat } from './hooks/useChat';
import { useAppStore } from './store';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const online = useHealth();
  const { send } = useChat();

  // Mirror theme to body class for global CSS variables
  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      <div
        id="overlay"
        aria-hidden="true"
        className={sidebarOpen ? 'show' : ''}
        onClick={() => setSidebarOpen(false)}
      />

      <main id="main">
        <TopBar onMenuClick={() => setSidebarOpen(true)} online={online} />
        <MessageList onSend={send} />
        <InputArea onSend={send} />
      </main>

      <Toast />
    </>
  );
}
