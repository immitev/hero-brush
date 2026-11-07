/**
 * Game clock based on performance.now() deltas.
 * - Robust to tab throttling: each tick clamps the real-time delta so a long gap
 *   (background tab, device sleep) never jumps the session forward.
 * - Pausable: paused time is simply not accumulated.
 * - `speed` multiplier is used by the dev-only `?fast=1` mode.
 */
export class GameClock {
  /** Accumulated game time in seconds. */
  elapsed = 0;
  /** Game seconds per real second. */
  speed = 1;
  /** Maximum real-time delta accepted per tick, in seconds. */
  maxDelta = 0.25;

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
   * Advances the clock. Returns the real-time delta that was consumed (already
   * clamped and scaled by `speed`), so callers can use it as their frame dt.
   */
  tick(): number {
    if (!this.running) return 0;
    const t = this.now();
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > this.maxDelta) dt = this.maxDelta;
    const gameDt = dt * this.speed;
    this.elapsed += gameDt;
    return gameDt;
  }
}
