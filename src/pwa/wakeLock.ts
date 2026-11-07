/** Screen Wake Lock: keeps the phone awake while brushing. Silently no-ops where unsupported. */
type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void };

let sentinel: WakeLockSentinelLike | null = null;
let wanted = false;

async function request(): Promise<void> {
  const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
  if (!nav.wakeLock || sentinel) return;
  try {
    sentinel = await nav.wakeLock.request('screen');
    sentinel.addEventListener?.('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

function onVisibility(): void {
  if (wanted && document.visibilityState === 'visible') void request();
}

export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  document.addEventListener('visibilitychange', onVisibility);
  await request();
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  document.removeEventListener('visibilitychange', onVisibility);
  const s = sentinel;
  sentinel = null;
  if (s) {
    try {
      await s.release();
    } catch {
      /* ignore */
    }
  }
}
