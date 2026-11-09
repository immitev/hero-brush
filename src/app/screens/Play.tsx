/** Session + Victory share the 3D scene; the overlay switches with the phase. */
import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { SEGMENTS, formatClock } from '../../game/segments';
import { type SessionResult, useDressedSuit, useStore } from '../../game/store';
import { type SessionOutcome, useSessionRunner } from '../../game/useSessionRunner';
import { getHero } from '../../heroes';
import { type MessageKey, type Translator, useT } from '../../i18n';
import { GameScene } from '../../scene/GameScene';
import { MotionIcon, PauseIcon, StarIcon } from '../components/Icons';
import { MouthMap } from '../components/MouthMap';

export function Play() {
  const heroId = useStore((s) => s.heroId);
  const hero = getHero(heroId);
  const suit = useDressedSuit(hero);
  const session = useSessionRunner(hero);
  const { heroName } = useT();
  const { phase, paused, pause, resume } = session;

  // Keyboard on a PC: Space pauses / resumes, Escape pauses.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // don't also "click" the focused button
        if (paused) resume();
        else pause();
      } else if (e.key === 'Escape' && !paused) {
        pause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, paused, pause, resume]);

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

/** i18n key of the coaching instruction for a segment. */
export function instructionKey(segmentIndex: number): MessageKey {
  const s = SEGMENTS[segmentIndex];
  if (s.motion === 'flick') return s.row === 'upper' ? 'motion.flickDown' : 'motion.flickUp';
  return `motion.${s.motion}` as MessageKey;
}

function Hud({ onPause }: { onPause: () => void }) {
  const hud = useStore((s) => s.hud);
  const seg = SEGMENTS[hud.segmentIndex];
  const urgent = hud.timeLeft <= 10 && hud.phase === 'playing';
  const { t } = useT();
  return (
    <div className="hud">
      <div className="hud-upper">
        <div className="hud-top">
          <button className="icon-btn" onClick={onPause} aria-label={t('play.pause')}>
            <PauseIcon />
          </button>
          <div className="hud-zone" key={seg.id}>
            <div className="hud-zone-label">{t('play.brush')}</div>
            <div className="hud-zone-name">{t(`seg.${seg.id}` as MessageKey)}</div>
          </div>
          <MouthMap segmentIndex={hud.segmentIndex} size={84} />
        </div>
        {hud.phase === 'playing' && (
          <div className="coach" key={`coach-${seg.id}`} role="status">
            <MotionIcon motion={seg.motion} flickDown={seg.row === 'upper'} size={60} />
            <div className="coach-text">{t(instructionKey(hud.segmentIndex))}</div>
          </div>
        )}
      </div>
      <div className="hud-bottom">
        <div className={`clock ${urgent ? 'urgent' : ''}`}>{formatClock(hud.timeLeft)}</div>
        <div className="clean-bar" role="progressbar" aria-label={t('play.cleanAria')} aria-valuenow={Math.round(hud.clean * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="clean-bar-fill" style={{ width: `${Math.round(hud.clean * 100)}%` }} />
        </div>
        <div className="zone-dots">
          {SEGMENTS.map((s) => (
            <span key={s.id} className={s.index < hud.segmentIndex ? 'done' : s.index === hud.segmentIndex ? 'active' : ''} />
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
  const { t, tn, suitName, itemName } = useT();
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
        {result && result.unlockedItems.length > 0 && (
          <div className="unlock">
            {t('victory.newItems')} <strong>{result.unlockedItems.map((i) => itemName(i.category, i.id)).join(', ')}</strong>
          </div>
        )}
        <div className="streak-line">
          {result ? (result.streak.current > 0 ? tn('victory.streak', result.streak.current) : t('victory.noStreak')) : t('victory.saving')}
          {hint && <small>{hint}</small>}
        </div>
        <div className="rinse">{t('victory.spit')}</div>
        <small className="rinse-why">{t('victory.spitWhy')}</small>
        <small className="rinse-why">{t('victory.grownUp')}</small>
      </div>
      {result && result.unlockedItems.length > 0 && (
        <button className="btn btn-ghost ward-open" onClick={() => go('wardrobe')}>
          <span aria-hidden="true">👕</span> {t('wardrobe.open')}
        </button>
      )}
      <button className="btn btn-big" onClick={() => go('hub')}>
        {t('victory.done')}
      </button>
    </div>
  );
}
