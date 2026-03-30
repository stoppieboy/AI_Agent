import { useAppStore } from '../store';
import type { Mode } from '../types';

interface Props {
  onMenuClick: () => void;
  online: boolean | null;
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'agent', label: 'Agent' },
  { mode: 'chat', label: 'Chat' },
];

export function TopBar({ onMenuClick, online }: Props) {
  const { mode, setMode } = useAppStore();

  const statusTitle =
    online === null ? 'Checking connection…' : online ? 'Connected' : 'Cannot reach server';

  return (
    <header id="topbar">
      <button
        id="menu-btn"
        aria-label="Open sidebar"
        aria-expanded={false}
        onClick={onMenuClick}
      >
        ☰
      </button>

      <div id="mode-tabs" role="tablist" aria-label="Mode">
        {TABS.map((t) => (
          <button
            key={t.mode}
            className={`tab-btn${mode === t.mode ? ' active' : ''}`}
            role="tab"
            aria-selected={mode === t.mode}
            onClick={() => setMode(t.mode)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id="status-dot"
        className={online === false ? 'offline' : ''}
        title={statusTitle}
        aria-label={statusTitle}
      />
    </header>
  );
}
