import { useEffect } from 'react';
import { unlockAudio } from '../../audio/engine';
import { sfx } from '../../audio/sfx';
import { primeSpeech } from '../../audio/voice';
import { useStore } from '../../game/store';
import { LANGS, LANG_LABEL, LANG_NAME, useT } from '../../i18n';
import { useInstallPrompt } from '../../pwa/install';
import { FlameIcon, StarIcon } from '../components/Icons';

export function Hub() {
  const go = useStore((s) => s.go);
  const totalStars = useStore((s) => s.totalStars);
  const streak = useStore((s) => s.streak);
  const refreshStreak = useStore((s) => s.refreshStreak);
  const { canInstall, install } = useInstallPrompt();
  const lang = useStore((s) => s.settings.lang);
  const updateSettings = useStore((s) => s.updateSettings);
  const { t, tn } = useT();

  // the date may have changed since the app was opened (left open overnight)
  useEffect(() => {
    refreshStreak();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshStreak();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refreshStreak]);

  const onGo = async () => {
    // iOS: speech and audio must be kicked off synchronously inside the tap
    primeSpeech();
    await unlockAudio();
    sfx.go();
    go('select');
  };

  return (
    <div className="screen hub">
      <div className="bubbles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, width: 20 + ((i * 13) % 40), height: 20 + ((i * 13) % 40) }} />
        ))}
      </div>
      <header className="hub-stats">
        <div className="stat">
          <StarIcon size={26} />
          <span>{totalStars}</span>
        </div>
        <div className="stat">
          <FlameIcon size={26} />
          <span>{streak.current}</span>
          <small>{tn('hub.days', streak.current)}</small>
        </div>
        <div className="lang-toggle" role="group" aria-label={t('hub.langAria')}>
          {LANGS.map((l) => (
            <button
              key={l}
              className={l === lang ? 'active' : ''}
              aria-pressed={l === lang}
              aria-label={LANG_NAME[l]}
              lang={l}
              onClick={() => {
                sfx.tap();
                updateSettings({ lang: l });
              }}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </header>

      <div className="hub-title">
        <h1>
          <span>HERO</span>
          <span>BRUSH</span>
        </h1>
        <p>{streak.brushedToday ? t('hub.taglineBrushed') : t('hub.tagline')}</p>
      </div>

      <button className={`go-button ${t('hub.go').length > 4 ? 'long' : ''}`} onClick={() => void onGo()} aria-label={t('hub.goAria')}>
        <span>{t('hub.go')}</span>
      </button>

      <footer className="hub-footer">
        {canInstall && (
          <button className="btn btn-ghost btn-small" onClick={() => void install()}>
            {t('hub.install')}
          </button>
        )}
        <button className="btn btn-ghost btn-small" onClick={() => go('parent')}>
          {t('hub.parents')}
        </button>
      </footer>
    </div>
  );
}
