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

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
