import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn('SW registration failed', err);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span>New version ready.</span>
      <button className="btn btn-small" onClick={() => void updateServiceWorker(true)}>
        Reload
      </button>
      <button className="btn btn-small btn-ghost" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">
        Later
      </button>
    </div>
  );
}
