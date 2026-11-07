import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStore } from '../../game/store';
import { useT } from '../../i18n';

/** Stays mounted (one SW registration) but only shows outside the game screens. */
export function UpdatePrompt() {
  const screen = useStore((s) => s.screen);
  const { t } = useT();
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
      <span>{t('toast.update')}</span>
      <button className="btn btn-small" onClick={() => void updateServiceWorker(true)}>
        {t('toast.reload')}
      </button>
      <button className="btn btn-small btn-ghost" onClick={() => setNeedRefresh(false)} aria-label={t('toast.dismiss')}>
        {t('toast.later')}
      </button>
    </div>
  );
}
