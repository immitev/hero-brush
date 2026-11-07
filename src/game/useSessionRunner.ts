/**
 * Drives one brushing session: countdown → playing → victory.
 * Owns the GameClock, the rAF loop, voice/SFX cues, music, wake lock and
 * pause/resume (including auto-pause when the tab is hidden).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { resumeAudio, suspendAudio } from '../audio/engine';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { speak, stopSpeaking } from '../audio/voice';
import type { HeroPack } from '../heroes';
import { acquireWakeLock, releaseWakeLock } from '../pwa/wakeLock';
import { GameClock } from './clock';
import { countdownAt } from './countdown';
import { resetRuntime, runtime, type Phase } from './runtime';
import { MIN_RECORD_SECONDS } from './scoring';
import { stepSimulation } from './simulation';
import { type SessionResult, useStore } from './store';
import { BOSS_START, SESSION_SECONDS, ZONES, isSessionComplete, timeLeft } from './zones';

export interface SessionOutcome {
  completed: boolean;
  elapsed: number;
}

export interface SessionApi {
  phase: Phase;
  paused: boolean;
  /** Known as soon as the session ends (before the result is saved). */
  outcome: SessionOutcome | null;
  /** The saved result (stars, unlocks, streak); null while saving. */
  result: SessionResult | null;
  pause: () => void;
  resume: () => void;
  quit: () => void;
}

interface RunnerState {
  clock: GameClock;
  finished: boolean;
  disposed: boolean;
  lastHud: number;
  countdownStep: number;
  midwaySaid: boolean;
  startedAt: number;
  lastFrame: number;
  timers: Set<number>;
}

export function useSessionRunner(hero: HeroPack): SessionApi {
  const speed = useStore((s) => s.speed);
  const setHud = useStore((s) => s.setHud);
  const finishSession = useStore((s) => s.finishSession);
  const beginSession = useStore((s) => s.beginSession);
  const go = useStore((s) => s.go);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const state = useRef<RunnerState>({
    clock: new GameClock(),
    finished: false,
    disposed: false,
    lastHud: 0,
    countdownStep: -1,
    midwaySaid: false,
    startedAt: 0,
    lastFrame: 0,
    timers: new Set(),
  });

  /** setTimeout that is cancelled on pause/quit/unmount and skipped while paused. */
  const later = useCallback((ms: number, fn: () => void) => {
    const s = state.current;
    const id = window.setTimeout(() => {
      s.timers.delete(id);
      if (s.disposed || runtime.paused) return;
      fn();
    }, ms);
    s.timers.add(id);
  }, []);

  const clearTimers = useCallback(() => {
    const s = state.current;
    for (const id of s.timers) clearTimeout(id);
    s.timers.clear();
  }, []);

  const finish = useCallback(
    async (completed: boolean) => {
      const s = state.current;
      if (s.finished) return;
      s.finished = true;
      const rt = runtime;
      const elapsed = Math.min(rt.elapsed, SESSION_SECONDS); // the last frame can overshoot
      rt.phase = 'victory';
      rt.victoryT = 0;
      rt.paused = false;
      s.clock.stop();
      clearTimers();
      music.stop(0.6);
      void releaseWakeLock();
      // the session may have ended from the pause menu, where audio was suspended
      void resumeAudio();
      setOutcome({ completed, elapsed });
      setPhase('victory');
      setPaused(false);
      if (completed) {
        later(350, () => sfx.victory());
        later(900, () => speak(hero.voice.victory));
      } else {
        speak('Good try! Come back and brush a little longer next time.');
      }
      const res = await finishSession(elapsed, completed, s.startedAt);
      if (!s.disposed) setResult(res);
    },
    [clearTimers, finishSession, hero, later],
  );

  const pause = useCallback(() => {
    const s = state.current;
    if (runtime.phase !== 'playing' && runtime.phase !== 'countdown') return;
    if (runtime.paused) return;
    runtime.paused = true;
    s.clock.pause();
    clearTimers();
    void suspendAudio();
    stopSpeaking();
    void releaseWakeLock();
    setPaused(true);
    setHud({ paused: true });
  }, [clearTimers, setHud]);

  const resume = useCallback(() => {
    const s = state.current;
    if (!runtime.paused) return;
    runtime.paused = false;
    s.clock.resume();
    void resumeAudio();
    void acquireWakeLock();
    if (runtime.phase === 'playing' && speed === 1) music.syncTo(runtime.elapsed);
    setPaused(false);
    setHud({ paused: false });
  }, [setHud, speed]);

  const quit = useCallback(() => {
    if (runtime.phase === 'playing' && runtime.elapsed >= MIN_RECORD_SECONDS) {
      void finish(false);
    } else {
      state.current.finished = true;
      runtime.phase = 'idle';
      runtime.paused = false;
      clearTimers();
      music.stop(0.2);
      stopSpeaking();
      void resumeAudio();
      void releaseWakeLock();
      go('hub');
    }
  }, [clearTimers, finish, go]);

  useEffect(() => {
    const s = state.current;
    s.finished = false;
    s.disposed = false;
    s.countdownStep = -1;
    s.midwaySaid = false;
    s.startedAt = Date.now();
    s.lastFrame = performance.now();
    beginSession();
    resetRuntime();
    const rt = runtime;
    rt.phase = 'countdown';
    s.clock = new GameClock();
    s.clock.speed = speed;
    s.clock.start();
    setPhase('countdown');
    setPaused(false);
    setOutcome(null);
    setResult(null);
    setHud({ phase: 'countdown', timeLeft: 120, zoneIndex: 0, bossActive: false, bossHealth: 1, countdown: 3, paused: false, kills: 0 });
    void acquireWakeLock();
    speak(hero.voice.start);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const nowMs = performance.now();
      const realDt = Math.min(0.1, (nowMs - s.lastFrame) / 1000);
      s.lastFrame = nowMs;
      const dt = s.clock.tick();
      if (rt.phase === 'countdown') {
        rt.countdownT += dt;
        const cd = countdownAt(rt.countdownT);
        if (cd.step !== s.countdownStep) {
          s.countdownStep = cd.step;
          if (cd.step > 0) sfx.countdown(false);
          else sfx.go();
        }
        if (cd.started) {
          rt.phase = 'playing';
          s.startedAt = Date.now();
          s.clock.start();
          music.start();
          speak(ZONES[0].voice);
          setPhase('playing');
        }
      } else if (rt.phase === 'playing') {
        rt.elapsed = s.clock.elapsed;
        const prevZone = rt.zoneIndex;
        const prevBoss = rt.bossActive;
        stepSimulation(rt, { hero });
        if (rt.zoneIndex !== prevZone) {
          sfx.zoneChime();
          speak(ZONES[rt.zoneIndex].voice);
          if (speed === 1) music.syncTo(rt.elapsed);
        }
        if (!prevBoss && rt.bossActive) {
          sfx.bossRoar();
          if (speed === 1) music.syncTo(Math.max(rt.elapsed, BOSS_START));
          later(600, () => speak(hero.voice.boss));
        }
        if (!s.midwaySaid && rt.elapsed >= 50) {
          s.midwaySaid = true;
          speak(hero.voice.midway, { interrupt: false });
        }
        if (isSessionComplete(rt.elapsed)) {
          void finish(true);
        }
      } else if (rt.phase === 'victory') {
        rt.victoryT += realDt; // the game clock is stopped; use real time
      }

      if (nowMs - s.lastHud > 100) {
        s.lastHud = nowMs;
        setHud({
          phase: rt.phase,
          timeLeft: timeLeft(rt.elapsed),
          zoneIndex: rt.zoneIndex,
          bossActive: rt.bossActive,
          bossHealth: rt.bossHealth,
          countdown: countdownAt(rt.countdownT).step,
          kills: rt.kills,
        });
      }
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      s.disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      s.clock.stop();
      clearTimers();
      music.stop(0.2);
      stopSpeaking();
      void releaseWakeLock();
      rt.phase = 'idle';
      rt.paused = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero.id]);

  return { phase, paused, outcome, result, pause, resume, quit };
}
