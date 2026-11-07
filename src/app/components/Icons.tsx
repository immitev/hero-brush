export function StarIcon({ size = 24, filled = true, className }: { size?: number; filled?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"
        fill={filled ? '#ffd166' : 'rgba(255,255,255,0.18)'}
        stroke={filled ? '#f4a300' : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlameIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 0-6 1-9.5z" fill="#ff7b3d" />
      <path d="M12 11c.6 2.2 2.4 3 2.4 5.2a2.4 2.4 0 0 1-4.8 0c0-1 .5-1.8 1-2.3 0 1 .5 1.5 1 1.5 0-1.5 0-2.8.4-4.4z" fill="#ffd166" />
    </svg>
  );
}

export function PauseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function ArrowIcon({ size = 28, dir = 'right' }: { size?: number; dir?: 'left' | 'right' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: dir === 'left' ? 'scaleX(-1)' : undefined }}>
      <path d="M5 12h12m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Animated cue for the current brushing motion:
 *  - circles: brush head at 45° to a gumline with a circling arrow
 *  - flick: vertical brush with an arrow sweeping away from the gum (up or down)
 *  - scrub: flat brush on a chewing surface sliding back and forth
 *  - tongue: tongue with an arrow from back to front
 */
export function MotionIcon({ motion, flickDown = true, size = 56 }: { motion: 'circles' | 'flick' | 'scrub' | 'tongue'; flickDown?: boolean; size?: number }) {
  const brush = (
    <g>
      <rect x="-16" y="-5" width="32" height="10" rx="4" fill="#f4f6fa" />
      <rect x="-14" y="5" width="28" height="4" fill="#9ff0dc" />
      <rect x="16" y="-3" width="22" height="6" rx="3" fill="#ffd166" />
    </g>
  );
  if (motion === 'circles') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className="motion-icon" aria-hidden="true">
        <path d="M6 20 Q32 12 58 20" stroke="#f08bb3" strokeWidth="6" fill="none" strokeLinecap="round" />
        <rect x="14" y="22" width="36" height="30" rx="8" fill="#fbfbff" />
        <g transform="translate(34 32) rotate(-45)">{brush}</g>
        <g className="motion-spin" style={{ transformOrigin: '32px 38px' }}>
          <path d="M32 26 a12 12 0 1 1 -10 5" stroke="#ff6b9d" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M20 26 l2 6 6 -2" stroke="#ff6b9d" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  if (motion === 'flick') {
    const dir = flickDown ? 1 : -1;
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className="motion-icon" aria-hidden="true">
        <path d={flickDown ? 'M6 14 Q32 6 58 14' : 'M6 50 Q32 58 58 50'} stroke="#f08bb3" strokeWidth="6" fill="none" strokeLinecap="round" />
        <rect x="18" y={flickDown ? 16 : 14} width="28" height="34" rx="8" fill="#fbfbff" />
        <g className={flickDown ? 'motion-flick-down' : 'motion-flick-up'}>
          <g transform={`translate(44 ${flickDown ? 24 : 40}) rotate(${flickDown ? 90 : -90})`}>{brush}</g>
        </g>
        <path d={`M8 ${flickDown ? 22 : 42} l0 ${dir * 16}`} stroke="#ff6b9d" strokeWidth="3" strokeLinecap="round" />
        <path d={flickDown ? 'M4 34 l4 5 4 -5' : 'M4 30 l4 -5 4 5'} stroke="#ff6b9d" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (motion === 'scrub') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className="motion-icon" aria-hidden="true">
        <path d="M10 44 q8 -8 16 0 q6 6 12 0 q8 -8 16 0 v14 h-44 z" fill="#fbfbff" />
        <g className="motion-scrub">
          <g transform="translate(32 30)">{brush}</g>
        </g>
        <path d="M14 16 h36" stroke="#ff6b9d" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 12 l-4 4 4 4 M46 12 l4 4 -4 4" stroke="#ff6b9d" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="motion-icon" aria-hidden="true">
      <path d="M20 10 h24 q10 0 10 14 v26 q0 8 -22 8 q-22 0 -22 -8 v-26 q0 -14 10 -14 z" fill="#f47c9d" />
      <path d="M32 16 v36" stroke="#d96d8b" strokeWidth="2" />
      <g className="motion-tongue">
        <g transform="translate(32 30) rotate(90)">{brush}</g>
      </g>
      <path d="M58 20 v26" stroke="#ff6b9d" strokeWidth="3" strokeLinecap="round" />
      <path d="M53 40 l5 6 5 -6" stroke="#ff6b9d" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
