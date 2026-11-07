import { SEGMENTS } from '../../game/segments';
import { type MessageKey, useT } from '../../i18n';

/**
 * Mini mouth map: one region per segment (outer quadrants, inner back / front
 * arcs, the chewing ring and the tongue). The active one pulses; done ones
 * turn white. Drawn like a mirror: the left of the map is the child's left.
 */
const PATHS: Record<string, string> = {
  'upper-outer-left': 'M14 62 A46 46 0 0 1 60 16',
  'upper-outer-right': 'M60 16 A46 46 0 0 1 106 62',
  'lower-outer-left': 'M14 62 A46 46 0 0 0 60 108',
  'lower-outer-right': 'M60 108 A46 46 0 0 0 106 62',
  'upper-inner-back': 'M32 62 A28 28 0 0 1 44 40 M88 62 A28 28 0 0 0 76 40',
  'upper-inner-front': 'M44 40 A28 28 0 0 1 76 40',
  'lower-inner-back': 'M32 62 A28 28 0 0 0 44 84 M88 62 A28 28 0 0 1 76 84',
  'lower-inner-front': 'M44 84 A28 28 0 0 0 76 84',
  chewing: 'M23 62 A37 37 0 0 1 97 62 M23 62 A37 37 0 0 0 97 62',
};

export function MouthMap({ segmentIndex, size = 96 }: { segmentIndex: number; size?: number }) {
  const { t } = useT();
  const stateOf = (i: number) => (i < segmentIndex ? 'done' : i === segmentIndex ? 'active' : 'todo');
  const tongueState = stateOf(SEGMENTS.length - 1);
  return (
    <svg width={size} height={size} viewBox="0 0 120 124" className="mouthmap" aria-label={t('play.mouthMap', { zone: t(`seg.${SEGMENTS[segmentIndex].id}` as MessageKey) })}>
      <defs>
        <filter id="mm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="60" cy="62" rx="54" ry="52" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
      {SEGMENTS.filter((s) => s.surface !== 'tongue').map((s) => {
        const state = stateOf(s.index);
        return (
          <path
            key={s.id}
            d={PATHS[s.id]}
            className={`mouthmap-zone ${state}`}
            fill="none"
            strokeWidth={s.surface === 'outer' ? 9 : s.surface === 'chewing' ? 4 : 7}
            strokeDasharray={s.surface === 'chewing' ? '4 3' : undefined}
            strokeLinecap="round"
            filter={state === 'active' ? 'url(#mm-glow)' : undefined}
          />
        );
      })}
      <ellipse cx="60" cy="66" rx="13" ry="8" className={`mouthmap-tongue ${tongueState}`} filter={tongueState === 'active' ? 'url(#mm-glow)' : undefined} />
    </svg>
  );
}
