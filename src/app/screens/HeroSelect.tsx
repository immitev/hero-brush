import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { preloadVoices, say } from '../../audio/voice';
import { useDressedSuits, useStore } from '../../game/store';
import { HEROES } from '../../heroes';
import { useT } from '../../i18n';
import { HeroCarousel } from '../../scene/HeroCarousel';
import { ArrowIcon } from '../components/Icons';

export function HeroSelect() {
  const go = useStore((s) => s.go);
  const heroId = useStore((s) => s.heroId);
  const selectHero = useStore((s) => s.selectHero);
  const dressed = useDressedSuits();
  const [index, setIndex] = useState(() => Math.max(0, HEROES.findIndex((h) => h.id === heroId)));
  const hero = HEROES[index];
  const { t, lang, heroName } = useT();
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
      <HeroCarousel index={index} suits={dressed} />
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
          <button
            className="btn btn-ghost ward-open"
            onClick={() => {
              sfx.tap();
              selectHero(hero.id);
              go('wardrobe');
            }}
          >
            <span aria-hidden="true">👕</span> {t('wardrobe.open')}
          </button>
          <button className="btn btn-big" style={{ background: hero.ui.fg, color: '#1b1340' }} onClick={start}>
            {t('select.start', { hero: name })}
          </button>
        </div>
      </div>
    </div>
  );
}
