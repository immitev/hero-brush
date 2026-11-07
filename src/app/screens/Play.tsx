/** Session + Victory share the 3D scene; the overlay switches with the phase. */
import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { type SessionResult, useStore } from '../../game/store';
import { type SessionOutcome, useSessionRunner } from '../../game/useSessionRunner';
import { ZONES, formatClock } from '../../game/zones';
import { getHero, getSuit } from '../../heroes';
import { GameScene } from '../../scene/GameScene';
import { PauseIcon, StarIcon } from '../components/Icons';
import { MouthMap } from '../components/MouthMap';

export function Play() {
  const heroId = useStore((s) => s.heroId);
  const suits = useStore((s) => s.settings.suits);
  const hero = getHero(heroId);
  const suit = getSuit(hero, suits[hero.id]);
  const session = useSessionRunner(hero);

  return (
    <div className="screen play">
      <GameScene hero={hero} suit={suit} />
      {session.phase === 'countdown' && <CountdownOverlay heroName={hero.name} />}
      {(session.phase === 'playing' || session.phase === 'countdown') && <Hud onPause={session.pause} />}
      {session.paused && <PauseOverlay onResume={session.resume} onQuit={session.quit} />}
      {session.phase === 'victory' && <VictoryOverlay outcome={session.outcome} result={session.result} heroName={hero.name} />}
    </div>
  );
}

function CountdownOverlay({ heroName }: { heroName: string }) {
  const countdown = useStore((s) => s.hud.countdown);
  return (
    <div className="overlay countdown" aria-live="polite">
      <div className="countdown-hero">{heroName}</div>
      <div className="countdown-number" key={countdown}>
        {countdown > 0 ? countdown : 'GO!'}
      </div>
      <div className="countdown-hint">Toothbrush ready?</div>
    </div>
  );
}

function Hud({ onPause }: { onPause: () => void }) {
  const hud = useStore((s) => s.hud);
  const zone = ZONES[hud.zoneIndex];
  const urgent = hud.timeLeft <= 10 && hud.phase === 'playing';
  return (
    <div className="hud">
      <div className="hud-upper">
        <div className="hud-top">
          <button className="icon-btn" onClick={onPause} aria-label="Pause">
            <PauseIcon />
          </button>
          <div className="hud-zone" key={zone.id}>
            <div className="hud-zone-label">Brush</div>
            <div className="hud-zone-name">{zone.name}</div>
          </div>
          <MouthMap zoneIndex={hud.zoneIndex} size={84} />
        </div>
        {hud.bossActive && (
          <div className="boss-bar" role="progressbar" aria-valuenow={Math.round(hud.bossHealth * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="boss-bar-label">Cavity King</div>
            <div className="boss-bar-track">
              <div className="boss-bar-fill" style={{ width: `${hud.bossHealth * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="hud-bottom">
        <div className={`clock ${urgent ? 'urgent' : ''} ${hud.bossActive ? 'boss' : ''}`}>{formatClock(hud.timeLeft)}</div>
        <div className="zone-dots">
          {ZONES.map((z) => (
            <span key={z.id} className={z.index < hud.zoneIndex ? 'done' : z.index === hud.zoneIndex ? 'active' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="overlay pause">
      <div className="card">
        <h2>Paused</h2>
        {!confirm ? (
          <>
            <button className="btn btn-big" onClick={onResume}>
              Keep brushing
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
              Stop brushing
            </button>
          </>
        ) : (
          <>
            <p>Stopping early means fewer stars. Sure?</p>
            <button className="btn btn-big" onClick={() => setConfirm(false)}>
              No, keep going!
            </button>
            <button className="btn btn-ghost" onClick={onQuit}>
              Yes, stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function thirdStarHint(result: SessionResult): string | null {
  if (result.stars !== 2 || result.otherSlotDone) return null;
  return result.slot === 'morning' ? 'Brush again tonight for a 3rd star.' : 'Brush tomorrow morning and evening for 3 stars.';
}

function VictoryOverlay({ outcome, result, heroName }: { outcome: SessionOutcome | null; result: SessionResult | null; heroName: string }) {
  const go = useStore((s) => s.go);
  const [shown, setShown] = useState(0);
  const stars = result?.stars ?? 0;
  const completed = outcome?.completed ?? result?.completed ?? false;
  const elapsed = outcome?.elapsed ?? result?.elapsed ?? 0;

  useEffect(() => {
    if (!result) return;
    setShown(0);
    const timers: number[] = [];
    for (let i = 1; i <= stars; i++) {
      timers.push(
        window.setTimeout(() => {
          setShown(i);
          sfx.star(i);
        }, 500 + i * 450),
      );
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [result, stars]);

  const hint = result ? thirdStarHint(result) : null;
  return (
    <div className="overlay victory">
      <div className="victory-top">
        <h1>{completed ? 'Cavity King defeated!' : 'Good try!'}</h1>
        <p>{completed ? `${heroName} says: sparkling clean!` : `You brushed for ${formatClock(elapsed)}. Next time go for 2:00!`}</p>
      </div>
      <div className="stars" aria-label={result ? `${stars} stars` : 'Counting stars'}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= shown ? 'pop' : ''}>
            <StarIcon size={64} filled={i <= shown} />
          </span>
        ))}
      </div>
      <div className="victory-info">
        {result?.unlockedSuit && (
          <div className="unlock">
            New suit unlocked: <strong>{result.unlockedSuit.suitName}</strong>
          </div>
        )}
        <div className="streak-line">
          {result ? (result.streak.current > 0 ? `${result.streak.current}-day streak` : 'Start a streak tomorrow!') : 'Saving your stars...'}
          {hint && <small>{hint}</small>}
        </div>
        <div className="rinse">Now spit and rinse!</div>
      </div>
      <button className="btn btn-big" onClick={() => go('hub')}>
        Done
      </button>
    </div>
  );
}
