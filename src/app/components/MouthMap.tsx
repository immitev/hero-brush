import { ZONES } from '../../game/zones';

/** Mini mouth map: six regions, the active one pulses. */
export function MouthMap({ zoneIndex, size = 96 }: { zoneIndex: number; size?: number }) {
  // path for each zone id (upper/lower outer halves + inner arcs)
  const paths: Record<string, string> = {
    'upper-left-out': 'M14 62 A46 46 0 0 1 60 16',
    'upper-right-out': 'M60 16 A46 46 0 0 1 106 62',
    'lower-left-out': 'M14 62 A46 46 0 0 0 60 108',
    'lower-right-out': 'M60 108 A46 46 0 0 0 106 62',
    'upper-in': 'M32 62 A28 28 0 0 1 88 62',
    'lower-in': 'M32 62 A28 28 0 0 0 88 62',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 120 124" className="mouthmap" aria-label={`Brush: ${ZONES[zoneIndex].name}`}>
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
      {ZONES.map((z) => {
        const state = z.index < zoneIndex ? 'done' : z.index === zoneIndex ? 'active' : 'todo';
        return (
          <path
            key={z.id}
            d={paths[z.id]}
            className={`mouthmap-zone ${state}`}
            fill="none"
            strokeWidth={z.surface === 'inside' ? 7 : 9}
            strokeLinecap="round"
            filter={state === 'active' ? 'url(#mm-glow)' : undefined}
          />
        );
      })}
      {/* tongue */}
      <ellipse cx="60" cy="74" rx="14" ry="9" fill="#e84a6f" opacity="0.8" />
    </svg>
  );
}
