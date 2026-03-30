import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

export function useHealth(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  const serverUrl = useAppStore((s) => s.serverUrl);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const r = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setOnline(r.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    check();
    const interval = setInterval(check, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serverUrl]);

  return online;
}
