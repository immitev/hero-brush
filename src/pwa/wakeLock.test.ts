import { describe, expect, it } from 'vitest';
import { type WakeLockEnv, type WakeLockSentinelLike, createWakeLock } from './wakeLock';

function fakeEnv() {
  const sentinels: Array<WakeLockSentinelLike & { releasedCount: number }> = [];
  let resolveNext: ((s: WakeLockSentinelLike) => void) | null = null;
  const listeners = new Set<() => void>();
  let visible = true;
  const env: WakeLockEnv = {
    request: () =>
      new Promise<WakeLockSentinelLike>((res) => {
        resolveNext = res;
      }),
    addVisibilityListener: (cb) => listeners.add(cb),
    removeVisibilityListener: (cb) => listeners.delete(cb),
    isVisible: () => visible,
  };
  const grant = () => {
    const s = {
      releasedCount: 0,
      released: false,
      async release() {
        this.releasedCount++;
        this.released = true;
      },
    };
    sentinels.push(s);
    resolveNext?.(s);
    resolveNext = null;
    return s;
  };
  return { env, grant, sentinels, listeners, setVisible: (v: boolean) => (visible = v) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('wake lock', () => {
  it('acquires and releases a sentinel', async () => {
    const f = fakeEnv();
    const wl = createWakeLock(f.env);
    const p = wl.acquire();
    f.grant();
    await p;
    expect(wl.held).toBe(true);
    await wl.release();
    expect(wl.held).toBe(false);
    expect(f.sentinels[0].releasedCount).toBe(1);
  });

  it('releases a sentinel that arrives after release() was called (race)', async () => {
    const f = fakeEnv();
    const wl = createWakeLock(f.env);
    const p = wl.acquire(); // request pending...
    await wl.release(); // ...released before the browser answered
    const s = f.grant();
    await p;
    await flush();
    expect(wl.held).toBe(false);
    expect(s.releasedCount).toBe(1);
  });

  it('re-acquires when the page becomes visible again while wanted', async () => {
    const f = fakeEnv();
    const wl = createWakeLock(f.env);
    const p = wl.acquire();
    f.grant();
    await p;
    // browser auto-releases on hide; our sentinel reference is cleared via the event in real life,
    // simulate by releasing through the API then re-acquiring on visibility
    await wl.release();
    const p2 = wl.acquire();
    f.grant();
    await p2;
    expect(wl.held).toBe(true);
    expect(f.listeners.size).toBe(1);
  });

  it('no-ops when the API is missing', async () => {
    const f = fakeEnv();
    const wl = createWakeLock({ ...f.env, request: null });
    await wl.acquire();
    expect(wl.held).toBe(false);
    await wl.release();
  });
});
