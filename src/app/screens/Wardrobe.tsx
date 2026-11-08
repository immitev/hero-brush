/** Wardrobe: the child dresses the chosen hero with brushes, colours and add-ons won by brushing. */
import { type ReactNode, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { isSuitUnlocked, SUIT_UNLOCK_STARS, starsForHero } from '../../game/scoring';
import { useDressedSuits, useProgress, useStore } from '../../game/store';
import { ACCESSORIES, BRUSHES, COLORS, type Requirement, isMet, nextUnlock, reqProgress, type WardrobeCategory } from '../../game/wardrobe';
import { HEROES, getSuit } from '../../heroes';
import { useT } from '../../i18n';
import { HeroCarousel } from '../../scene/HeroCarousel';
import { FlameIcon, LockIcon, StarIcon } from '../components/Icons';

const ACCESSORY_ICON: Record<string, string> = {
  none: '✖',
  shades: '🕶️',
  crown: '👑',
  bow: '🎀',
  cap: '🧢',
  headphones: '🎧',
};

const TABS: WardrobeCategory[] = ['brush', 'colors', 'accessory'];

export function Wardrobe() {
  const go = useStore((s) => s.go);
  const heroId = useStore((s) => s.heroId);
  const settings = useStore((s) => s.settings);
  const sessions = useStore((s) => s.sessions);
  const setLook = useStore((s) => s.setLook);
  const selectSuit = useStore((s) => s.selectSuit);
  const progress = useProgress();
  const dressed = useDressedSuits();
  const { t, heroName, suitName, itemName } = useT();
  const [tab, setTab] = useState<WardrobeCategory>('brush');

  const index = Math.max(0, HEROES.findIndex((h) => h.id === heroId));
  const hero = HEROES[index];
  const look = settings.looks[hero.id] ?? {};
  const baseSuit = getSuit(hero, settings.suits[hero.id]);
  const next = nextUnlock(progress);

  const lockLabel = (req: Requirement) => {
    const r = reqProgress(req, progress);
    if (!r) return null;
    return (
      <span className="lock">
        <LockIcon /> {r.have}/{r.need} {r.kind === 'stars' ? <StarIcon size={12} /> : <FlameIcon size={12} />}
      </span>
    );
  };
  const hint = (req: Requirement) => {
    const r = reqProgress(req, progress);
    if (!r) return undefined;
    return r.kind === 'stars' ? t('wardrobe.needStars', { count: r.need }) : t('wardrobe.needStreak', { count: r.need });
  };

  const item = (key: string, label: string, swatch: ReactNode, active: boolean, req: Requirement, onPick: () => void) => {
    const unlocked = isMet(req, progress);
    return (
      <button
        key={key}
        className={`ward-item ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
        disabled={!unlocked}
        aria-pressed={active}
        title={unlocked ? label : hint(req)}
        onClick={() => {
          sfx.tap();
          onPick();
        }}
      >
        {swatch}
        <span className="ward-name">{label}</span>
        {!unlocked && lockLabel(req)}
      </button>
    );
  };

  const grad = (a: string, b: string) => <span className="ward-swatch" style={{ background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)` }} />;

  let items: ReactNode[] = [];
  if (tab === 'brush') {
    items = BRUSHES.map((b) =>
      item(
        b.id,
        itemName('brush', b.id),
        b.handle ? grad(b.handle, b.stripe ?? b.handle) : grad(baseSuit.palette.brush, baseSuit.palette.brush),
        (look.brush ?? 'hero') === b.id,
        b.req,
        () => setLook(hero.id, { brush: b.id }),
      ),
    );
  } else if (tab === 'colors') {
    const heroStars = starsForHero(sessions, hero.id);
    items = [
      ...hero.suits.map((s, i) => {
        // the hero's own suits keep their per-hero unlock (stars earned with this hero)
        const unlocked = isSuitUnlocked(sessions, hero.id, i);
        const active = !look.colors && baseSuit.id === s.id;
        return (
          <button
            key={`suit-${s.id}`}
            className={`ward-item ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
            disabled={!unlocked}
            aria-pressed={active}
            title={unlocked ? suitName(hero.id, s.id) : t('select.lockedHint', { stars: SUIT_UNLOCK_STARS * i, hero: heroName(hero.id) })}
            onClick={() => {
              sfx.tap();
              selectSuit(hero.id, s.id);
              setLook(hero.id, { colors: undefined });
            }}
          >
            {grad(s.palette.primary, s.palette.secondary)}
            <span className="ward-name">{suitName(hero.id, s.id)}</span>
            {!unlocked && (
              <span className="lock">
                <LockIcon /> {heroStars}/{SUIT_UNLOCK_STARS * i} <StarIcon size={12} />
              </span>
            )}
          </button>
        );
      }),
      ...COLORS.map((c) => item(c.id, itemName('colors', c.id), grad(c.primary, c.secondary), look.colors === c.id, c.req, () => setLook(hero.id, { colors: c.id }))),
    ];
  } else {
    items = ACCESSORIES.map((a) =>
      item(
        a.id,
        itemName('accessory', a.id),
        <span className="ward-swatch ward-emoji" aria-hidden="true">
          {ACCESSORY_ICON[a.id]}
        </span>,
        (look.accessory ?? 'none') === a.id,
        a.req,
        () => setLook(hero.id, { accessory: a.id }),
      ),
    );
  }

  return (
    <div className="screen select wardrobe" style={{ background: `radial-gradient(circle at 50% 30%, ${hero.ui.bg} 0%, #1b1340 70%)` }}>
      <HeroCarousel index={index} suits={dressed} />
      <div className="select-overlay">
        <div className="select-top">
          <button className="btn btn-ghost btn-small" onClick={() => go('select')}>
            {t('select.back')}
          </button>
          <h2>{heroName(hero.id)}</h2>
          <span className="ward-stars">
            <StarIcon size={18} /> {progress.totalStars}
          </span>
        </div>

        <div className="select-bottom ward-card">
          <div className="segmented ward-tabs" role="tablist">
            {TABS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? 'active' : ''}
                onClick={() => {
                  sfx.tap();
                  setTab(k);
                }}
              >
                {t(`wardrobe.tab.${k}`)}
              </button>
            ))}
          </div>
          <div className="ward-grid">{items}</div>
          <div className="ward-next">
            {next ? `${t('wardrobe.next', { item: itemName(next.category, next.id) })} · ${hint(next.req) ?? ''}` : t('wardrobe.allUnlocked')}
          </div>
          <button className="btn btn-big" style={{ background: hero.ui.fg, color: '#1b1340' }} onClick={() => go('select')}>
            {t('wardrobe.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
