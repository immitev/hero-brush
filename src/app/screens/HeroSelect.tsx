import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { speak } from '../../audio/voice';
import { isSuitUnlocked, SUIT_UNLOCK_STARS, starsForHero } from '../../game/scoring';
import { useStore } from '../../game/store';
import { HEROES, getSuit } from '../../heroes';
import { HeroCarousel } from '../../scene/HeroCarousel';
import { ArrowIcon, LockIcon, StarIcon } from '../components/Icons';

export function HeroSelect() {
  const go = useStore((s) => s.go);
  const heroId = useStore((s) => s.heroId);
  const selectHero = useStore((s) => s.selectHero);
  const selectSuit = useStore((s) => s.selectSuit);
  const suits = useStore((s) => s.settings.suits);
  const sessions = useStore((s) => s.sessions);
  const [index, setIndex] = useState(() => Math.max(0, HEROES.findIndex((h) => h.id === heroId)));
  const hero = HEROES[index];
  const suit = getSuit(hero, suits[hero.id]);

  useEffect(() => {
    speak(hero.voice.select);
  }, [hero]);

  const move = (d: number) => {
    sfx.tap();
    setIndex((i) => (i + d + HEROES.length) % HEROES.length);
  };

  const start = () => {
    selectHero(hero.id);
    sfx.go();
    go('play');
  };

  return (
    <div className="screen select" style={{ background: `radial-gradient(circle at 50% 30%, ${hero.ui.bg} 0%, #1b1340 70%)` }}>
      <HeroCarousel index={index} suits={suits} />
      <div className="select-overlay">
        <div className="select-top">
          <button className="btn btn-ghost btn-small" onClick={() => go('hub')}>
            Back
          </button>
          <h2>Pick your hero</h2>
          <span />
        </div>

        <div className="select-arrows">
          <button className="arrow" onClick={() => move(-1)} aria-label="Previous hero">
            <ArrowIcon dir="left" />
          </button>
          <button className="arrow" onClick={() => move(1)} aria-label="Next hero">
            <ArrowIcon dir="right" />
          </button>
        </div>

        <div className="select-bottom">
          <div className="hero-name" style={{ color: hero.ui.fg }}>
            {hero.name}
          </div>
          <div className="hero-tagline">{hero.tagline}</div>
          <div className="suits">
            {hero.suits.map((s, i) => {
              const unlocked = isSuitUnlocked(sessions, hero.id, i);
              const active = s.id === suit.id;
              return (
                <button
                  key={s.id}
                  className={`chip ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
                  disabled={!unlocked}
                  onClick={() => {
                    sfx.tap();
                    selectSuit(hero.id, s.id);
                  }}
                  title={unlocked ? s.name : `Earn ${SUIT_UNLOCK_STARS * i} stars with ${hero.name} to unlock`}
                >
                  <span className="swatch" style={{ background: `linear-gradient(135deg, ${s.palette.primary}, ${s.palette.secondary})` }} />
                  {s.name}
                  {!unlocked && (
                    <span className="lock">
                      <LockIcon /> {starsForHero(sessions, hero.id)}/{SUIT_UNLOCK_STARS * i} <StarIcon size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button className="btn btn-big" style={{ background: hero.ui.fg, color: '#1b1340' }} onClick={start}>
            Brush with {hero.name}!
          </button>
        </div>
      </div>
    </div>
  );
}
