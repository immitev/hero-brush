/** Session + Victory share the 3D scene; the overlay switches with the phase. */
import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { type SessionResult, useStore } from '../../game/store';
import { type SessionOutcome, useSessionRunner } from '../../game/useSessionRunner';
import { ZONES, formatClock } from '../../game/zones';
import { getHero, getSuit } from '../../heroes';
import { type MessageKey, type Translator, useT } from '../../i18n';
import { GameScene } from '../../scene/GameScene';
import { PauseIcon, StarIcon } from '../components/Icons';
import { MouthMap } from '../components/MouthMap';

export function Play() {
  const heroId = useStore((s) => s.heroId);
  const suits = useStore((s) => s.settings.suits);
  const hero = getHero(heroId);
  const suit = getSuit(hero, suits[hero.id]);
  const session = useSessionRunner(hero);
  const { heroName } = useT();

  return (
    <div className="screen play">
      <GameScene hero={hero} suit={suit} />
      {session.phase === 'countdown' && <CountdownOverlay heroName={heroName(hero.id)} />}
      {(session.phase === 'playing' || session.phase === 'countdown') && <Hud onPause={session.pause} />}
      {session.paused && <PauseOverlay onResume={session.resume} onQuit={session.quit} />}
      {session.phase === 'victory' && <VictoryOverlay outcome={session.outcome} result={session.result} heroName={heroName(hero.id)} />}
    </div>
  );
}

function CountdownOverlay({ heroName }: { heroName: string }) {
  const countdown = useStore((s) => s.hud.countdown);
  const { t } = useT();
  const go = t('play.go');
  return (
    <div className="overlay countdown" aria-live="polite">
      <div className="countdown-hero">{heroName}</div>
      <div className={`countdown-number ${countdown <= 0 && go.length > 4 ? 'long' : ''}`} key={countdown}>
        {countdown > 0 ? countdown : go}
      </div>
      <div className="countdown-hint">{t('play.ready')}</div>
    </div>
  );
}

function Hud({ onPause }: { onPause: () => void }) {
  const hud = useStore((s) => s.hud);
  const zone = ZONES[hud.zoneIndex];
  const urgent = hud.timeLeft <= 10 && hud.phase === 'playing';
  const { t } = useT();
  return (
    <div className="hud">
      <div className="hud-upper">
        <div className="hud-top">
          <button className="icon-btn" onClick={onPause} aria-label={t('play.pause')}>
            <PauseIcon />
          </button>
          <div className="hud-zone" key={zone.id}>
            <div className="hud-zone-label">{t('play.brush')}</div>
            <div className="hud-zone-name">{t(`zone.${zone.id}` as MessageKey)}</div>
          </div>
          <MouthMap zoneIndex={hud.zoneIndex} size={84} />
        </div>
        {hud.bossActive && (
          <div className="boss-bar" role="progressbar" aria-valuenow={Math.round(hud.bossHealth * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="boss-bar-label">{t('play.boss')}</div>
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
  const { t } = useT();
  return (
    <div className="overlay pause">
      <div className="card">
        <h2>{t('pause.title')}</h2>
        {!confirm ? (
          <>
            <button className="btn btn-big" onClick={onResume}>
              {t('pause.resume')}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
              {t('pause.stop')}
            </button>
          </>
        ) : (
          <>
            <p>{t('pause.confirm')}</p>
            <button className="btn btn-big" onClick={() => setConfirm(false)}>
              {t('pause.no')}
            </button>
            <button className="btn btn-ghost" onClick={onQuit}>
              {t('pause.yes')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function thirdStarHint(result: SessionResult, t: Translator['t']): string | null {
  if (result.stars !== 2 || result.otherSlotDone) return null;
  return result.slot === 'morning' ? t('victory.hintEvening') : t('victory.hintTomorrow');
}

function VictoryOverlay({ outcome, result, heroName }: { outcome: SessionOutcome | null; result: SessionResult | null; heroName: string }) {
  const go = useStore((s) => s.go);
  const { t, tn, suitName } = useT();
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

  const hint = result ? thirdStarHint(result, t) : null;
  return (
    <div className="overlay victory">
      <div className="victory-top">
        <h1>{completed ? t('victory.won') : t('victory.goodTry')}</h1>
        <p>{completed ? t('victory.wonSub', { hero: heroName }) : t('victory.triedSub', { time: formatClock(elapsed) })}</p>
      </div>
      <div className="stars" aria-label={result ? tn('victory.stars', stars) : t('victory.counting')}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= shown ? 'pop' : ''}>
            <StarIcon size={64} filled={i <= shown} />
          </span>
        ))}
      </div>
      <div className="victory-info">
        {result?.unlockedSuit && (
          <div className="unlock">
            {t('victory.unlocked')} <strong>{suitName(result.unlockedSuit.heroId, result.unlockedSuit.suitId)}</strong>
          </div>
        )}
        <div className="streak-line">
          {result ? (result.streak.current > 0 ? tn('victory.streak', result.streak.current) : t('victory.noStreak')) : t('victory.saving')}
          {hint && <small>{hint}</small>}
        </div>
        <div className="rinse">{t('victory.rinse')}</div>
      </div>
      <button className="btn btn-big" onClick={() => go('hub')}>
        {t('victory.done')}
      </button>
    </div>
  );
}
