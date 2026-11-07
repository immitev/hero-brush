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
import { resetRuntime, runtime, type Phase } from './runtime';
import { MIN_RECORD_SECONDS } from './scoring';
import { stepSimulation } from './simulation';
import { type SessionResult, useStore } from './store';
import { ZONES, isSessionComplete, timeLeft } from './zones';

const COUNTDOWN_SECONDS = 3.2;

export interface SessionApi {
  phase: Phase;
  paused: boolean;
  result: SessionResult | null;
  pause: () => void;
  resume: () => void;
  quit: () => void;
}

export function useSessionRunner(hero: HeroPack): SessionApi {
  const speed = useStore((s) => s.speed);
  const setHud = useStore((s) => s.setHud);
  const finishSession = useStore((s) => s.finishSession);
  const go = useStore((s) => s.go);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const state = useRef({
    clock: new GameClock(),
    finished: false,
    lastHud: 0,
    countdownStep: -1,
    midwaySaid: false,
  });

  const finish = useCallback(
    async (completed: boolean) => {
      const s = state.current;
      if (s.finished) return;
      s.finished = true;
      const rt = runtime;
      const elapsed = rt.elapsed;
      rt.phase = 'victory';
      rt.victoryT = 0;
      rt.paused = false;
      s.clock.stop();
      music.stop(0.6);
      void releaseWakeLock();
      setPhase('victory');
      setPaused(false);
      if (completed) {
        window.setTimeout(() => sfx.victory(), 350);
        window.setTimeout(() => speak(hero.voice.victory), 900);
      } else {
        speak('Good try! Come back and brush a little longer next time.');
      }
      const res = await finishSession(elapsed, completed);
      setResult(res);
    },
    [finishSession, hero],
  );

  const pause = useCallback(() => {
    const s = state.current;
    if (runtime.phase !== 'playing' && runtime.phase !== 'countdown') return;
    if (runtime.paused) return;
    runtime.paused = true;
    s.clock.pause();
    void suspendAudio();
    stopSpeaking();
    setPaused(true);
    setHud({ paused: true });
  }, [setHud]);

  const resume = useCallback(() => {
    const s = state.current;
    if (!runtime.paused) return;
    runtime.paused = false;
    s.clock.resume();
    void resumeAudio();
    setPaused(false);
    setHud({ paused: false });
  }, [setHud]);

  const quit = useCallback(() => {
    if (runtime.phase === 'playing' && runtime.elapsed >= MIN_RECORD_SECONDS) {
      void finish(false);
    } else {
      state.current.finished = true;
      runtime.phase = 'idle';
      music.stop(0.2);
      stopSpeaking();
      void releaseWakeLock();
      go('hub');
    }
  }, [finish, go]);

  useEffect(() => {
    const s = state.current;
    s.finished = false;
    s.countdownStep = -1;
    s.midwaySaid = false;
    resetRuntime();
    const rt = runtime;
    rt.phase = 'countdown';
    s.clock = new GameClock();
    s.clock.speed = speed;
    s.clock.start();
    setPhase('countdown');
    setPaused(false);
    setResult(null);
    setHud({ phase: 'countdown', timeLeft: 120, zoneIndex: 0, bossActive: false, bossHealth: 1, countdown: 3, paused: false, kills: 0 });
    void acquireWakeLock();
    speak(hero.voice.start);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = s.clock.tick();
      if (rt.phase === 'countdown') {
        rt.countdownT += dt;
        const step = Math.max(0, Math.ceil(COUNTDOWN_SECONDS - rt.countdownT));
        if (step !== s.countdownStep) {
          s.countdownStep = step;
          if (step > 0) sfx.countdown(false);
        }
        if (rt.countdownT >= COUNTDOWN_SECONDS) {
          rt.phase = 'playing';
          s.clock.start();
          music.start();
          sfx.go();
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
        }
        if (!prevBoss && rt.bossActive) {
          sfx.bossRoar();
          window.setTimeout(() => speak(hero.voice.boss), 600);
        }
        if (!s.midwaySaid && rt.elapsed >= 50) {
          s.midwaySaid = true;
          speak(hero.voice.midway, { interrupt: false });
        }
        if (isSessionComplete(rt.elapsed)) {
          void finish(true);
        }
      } else if (rt.phase === 'victory') {
        rt.victoryT += dt;
      }

      const now = performance.now();
      if (now - s.lastHud > 100) {
        s.lastHud = now;
        setHud({
          phase: rt.phase,
          timeLeft: timeLeft(rt.elapsed),
          zoneIndex: rt.zoneIndex,
          bossActive: rt.bossActive,
          bossHealth: rt.bossHealth,
          countdown: Math.max(0, Math.ceil(COUNTDOWN_SECONDS - rt.countdownT)),
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
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      s.clock.stop();
      music.stop(0.2);
      stopSpeaking();
      void releaseWakeLock();
      rt.phase = 'idle';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero.id]);

  return { phase, paused, result, pause, resume, quit };
}
