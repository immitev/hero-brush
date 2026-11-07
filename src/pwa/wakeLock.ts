/**
 * Screen Wake Lock: keeps the phone awake while brushing. Silently no-ops where
 * unsupported. Handles the race where `release()` is called while a `request()`
 * is still pending: a sentinel that arrives after the lock is no longer wanted
 * is released immediately.
 */
export type WakeLockSentinelLike = {
  release: () => Promise<void>;
  released?: boolean;
  addEventListener?: (t: string, cb: () => void) => void;
};

export interface WakeLockEnv {
  request: ((type: 'screen') => Promise<WakeLockSentinelLike>) | null;
  addVisibilityListener: (cb: () => void) => void;
  removeVisibilityListener: (cb: () => void) => void;
  isVisible: () => boolean;
}

function browserEnv(): WakeLockEnv {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }) : undefined;
  const hasDoc = typeof document !== 'undefined';
  return {
    request: nav?.wakeLock ? (type) => nav.wakeLock!.request(type) : null,
    addVisibilityListener: (cb) => hasDoc && document.addEventListener('visibilitychange', cb),
    removeVisibilityListener: (cb) => hasDoc && document.removeEventListener('visibilitychange', cb),
    isVisible: () => !hasDoc || document.visibilityState === 'visible',
  };
}

export function createWakeLock(env: WakeLockEnv = browserEnv()) {
  let sentinel: WakeLockSentinelLike | null = null;
  let wanted = false;
  let pending = 0;

  async function releaseSentinel(s: WakeLockSentinelLike | null): Promise<void> {
    if (!s) return;
    try {
      await s.release();
    } catch {
      /* ignore */
    }
  }

  async function request(): Promise<void> {
    if (!env.request || sentinel || pending > 0) return;
    pending++;
    try {
      const s = await env.request('screen');
      if (!wanted || sentinel) {
        // released (or re-acquired) while we were waiting: drop this one
        await releaseSentinel(s);
        return;
      }
      sentinel = s;
      s.addEventListener?.('release', () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      /* not granted */
    } finally {
      pending--;
    }
  }

  const onVisibility = () => {
    if (wanted && env.isVisible()) void request();
  };

  return {
    async acquire(): Promise<void> {
      if (!wanted) {
        wanted = true;
        env.addVisibilityListener(onVisibility);
      }
      await request();
    },
    async release(): Promise<void> {
      wanted = false;
      env.removeVisibilityListener(onVisibility);
      const s = sentinel;
      sentinel = null;
      await releaseSentinel(s);
    },
    /** For tests / diagnostics. */
    get held(): boolean {
      return sentinel !== null;
    },
    get wanted(): boolean {
      return wanted;
    },
  };
}

const shared = createWakeLock();

export const acquireWakeLock = (): Promise<void> => shared.acquire();
export const releaseWakeLock = (): Promise<void> => shared.release();
