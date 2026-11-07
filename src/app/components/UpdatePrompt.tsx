import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStore } from '../../game/store';

/** Stays mounted (one SW registration) but only shows outside the game screens. */
export function UpdatePrompt() {
  const screen = useStore((s) => s.screen);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn('SW registration failed', err);
    },
  });
  if (!needRefresh) return null;
  if (screen !== 'hub' && screen !== 'parent') return null;
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
