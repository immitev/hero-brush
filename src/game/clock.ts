/**
 * Game clock based on performance.now() deltas.
 * - Robust to tab throttling: each tick clamps the *raw real-time* delta so a
 *   long gap (background tab, device sleep) never jumps the session forward.
 * - Pausable: paused time is simply not accumulated.
 * - `speed` multiplier is used by the dev-only `?fast=1` mode. It is applied
 *   AFTER the clamp, so a slow frame rate still yields the requested speed.
 */
export class GameClock {
  /** Accumulated game time in seconds. */
  elapsed = 0;
  /** Game seconds per real second. */
  speed = 1;
  /** Maximum raw real-time delta accepted per tick, in seconds. */
  maxDelta = 0.5;

  private running = false;
  private last = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  get isRunning(): boolean {
    return this.running;
  }

  /** Resets elapsed time to zero and starts counting. */
  start(): void {
    this.elapsed = 0;
    this.running = true;
    this.last = this.now();
  }

  pause(): void {
    if (!this.running) return;
    this.tick();
    this.running = false;
  }

  resume(): void {
    if (this.running) return;
    this.running = true;
    this.last = this.now();
  }

  stop(): void {
    this.running = false;
  }

  /**
   * Advances the clock. Returns the game-time delta that was consumed (raw
   * delta clamped to `maxDelta`, then scaled by `speed`).
   */
  tick(): number {
    if (!this.running) return 0;
    const t = this.now();
    let raw = (t - this.last) / 1000;
    this.last = t;
    if (!Number.isFinite(raw) || raw < 0) raw = 0;
    const clamped = Math.min(raw, this.maxDelta);
    const gameDt = clamped * this.speed;
    this.elapsed += gameDt;
    return gameDt;
  }
}
