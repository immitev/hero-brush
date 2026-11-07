import { unlockAudio } from '../../audio/engine';
import { sfx } from '../../audio/sfx';
import { useStore } from '../../game/store';
import { useInstallPrompt } from '../../pwa/install';
import { FlameIcon, StarIcon } from '../components/Icons';

export function Hub() {
  const go = useStore((s) => s.go);
  const totalStars = useStore((s) => s.totalStars);
  const streak = useStore((s) => s.streak);
  const { canInstall, install } = useInstallPrompt();

  const onGo = async () => {
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
          <small>day{streak.current === 1 ? '' : 's'}</small>
        </div>
      </header>

      <div className="hub-title">
        <h1>
          <span>HERO</span>
          <span>BRUSH</span>
        </h1>
        <p>{streak.brushedToday ? 'Brushed today. Ready for round two?' : 'Two minutes. Six zones. One Cavity King.'}</p>
      </div>

      <button className="go-button" onClick={() => void onGo()} aria-label="Go! Start brushing">
        <span>GO!</span>
      </button>

      <footer className="hub-footer">
        {canInstall && (
          <button className="btn btn-ghost btn-small" onClick={() => void install()}>
            Install app
          </button>
        )}
        <button className="btn btn-ghost btn-small" onClick={() => go('parent')}>
          Parents
        </button>
      </footer>
    </div>
  );
}
