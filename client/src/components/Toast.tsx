import { useEffect } from 'react';
import { useAppStore } from '../store';

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hideToast, 4000);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  return (
    <div id="toast" className={toast ? 'show' : ''} role="alert" aria-live="assertive">
      {toast}
    </div>
  );
}
