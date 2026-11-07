import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { preloadVoices, say } from '../../audio/voice';
import { isSuitUnlocked, SUIT_UNLOCK_STARS, starsForHero } from '../../game/scoring';
import { useStore } from '../../game/store';
import { HEROES, getSuit } from '../../heroes';
import { useT } from '../../i18n';
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
  const { t, lang, heroName, suitName } = useT();
  const name = heroName(hero.id);

  useEffect(() => {
    void preloadVoices(
      HEROES.map((h) => h.id),
      ['select'],
    );
  }, [lang]);

  useEffect(() => {
    say(hero.id, 'select', 'high');
  }, [hero, lang]);

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
            {t('select.back')}
          </button>
          <h2>{t('select.title')}</h2>
          <span />
        </div>

        <div className="select-arrows">
          <button className="arrow" onClick={() => move(-1)} aria-label={t('select.prev')}>
            <ArrowIcon dir="left" />
          </button>
          <button className="arrow" onClick={() => move(1)} aria-label={t('select.next')}>
            <ArrowIcon dir="right" />
          </button>
        </div>

        <div className="select-bottom">
          <div className="hero-name" style={{ color: hero.ui.fg }}>
            {name}
          </div>
          <div className="hero-tagline">{t(`hero.${hero.id}.tagline`)}</div>
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
                  title={unlocked ? suitName(hero.id, s.id) : t('select.lockedHint', { stars: SUIT_UNLOCK_STARS * i, hero: name })}
                >
                  <span className="swatch" style={{ background: `linear-gradient(135deg, ${s.palette.primary}, ${s.palette.secondary})` }} />
                  {suitName(hero.id, s.id)}
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
            {t('select.start', { hero: name })}
          </button>
        </div>
      </div>
    </div>
  );
}
