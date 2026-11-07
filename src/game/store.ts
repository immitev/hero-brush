import { create } from 'zustand';
import { HEROES } from '../heroes';
import {
  type SessionRecord,
  type Slot,
  type StreakInfo,
  computeStars,
  computeStreak,
  isSuitUnlocked,
  sessionTimeInfo,
  totalStars,
  MIN_RECORD_SECONDS,
} from './scoring';
import { SESSION_SECONDS } from './segments';
import { DEFAULT_SETTINGS, type Settings, addSession, loadSessions, loadSettings, saveSettings, clearAllData } from '../storage/db';
import type { Phase } from './runtime';

export type Screen = 'hub' | 'select' | 'play' | 'parent';

export interface Hud {
  phase: Phase;
  timeLeft: number;
  segmentIndex: number;
  /** Overall cleanliness 0..1. */
  clean: number;
  /** 3, 2, 1 or 0 for "GO!". */
  countdown: number;
  paused: boolean;
}

export interface SessionResult {
  stars: number;
  elapsed: number;
  completed: boolean;
  heroId: string;
  /** Slot the session started in. */
  slot: Slot;
  /** Whether the other slot of the same day was already completed. */
  otherSlotDone: boolean;
  unlockedSuit: { heroId: string; suitId: string } | null;
  streak: StreakInfo;
}

export interface AppState {
  ready: boolean;
  screen: Screen;
  heroId: string;
  settings: Settings;
  sessions: SessionRecord[];
  streak: StreakInfo;
  totalStars: number;
  lastResult: SessionResult | null;
  hud: Hud;
  /** Dev-only speed multiplier from `?fast=1`. */
  speed: number;
  /** Set when the PerformanceMonitor decides the device is too slow. */
  forcedLowQuality: boolean;

  hydrate: () => Promise<void>;
  go: (screen: Screen) => void;
  selectHero: (heroId: string) => void;
  selectSuit: (heroId: string, suitId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setHud: (patch: Partial<Hud>) => void;
  setForcedLowQuality: (v: boolean) => void;
  /** Clears the previous result; call when a new session starts. */
  beginSession: () => void;
  /** Recomputes streak / brushedToday against the current date. */
  refreshStreak: () => void;
  /** Records a finished (or abandoned) session that started at `startedAt` and returns its result. */
  finishSession: (elapsed: number, completed: boolean, startedAt: number) => Promise<SessionResult>;
  resetAllData: () => Promise<void>;
  effectiveQuality: () => 'low' | 'high';
}

function readSpeed(): number {
  if (typeof location === 'undefined') return 1;
  const v = new URLSearchParams(location.search).get('fast');
  if (v === null) return 1;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n === 1 ? 10 : Math.min(60, n);
}

const EMPTY_STREAK: StreakInfo = { current: 0, best: 0, perfectDays: 0, brushedToday: false, todaySlots: [] };

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  screen: 'hub',
  heroId: HEROES[0].id,
  settings: { ...DEFAULT_SETTINGS },
  sessions: [],
  streak: EMPTY_STREAK,
  totalStars: 0,
  lastResult: null,
  hud: { phase: 'idle', timeLeft: SESSION_SECONDS, segmentIndex: 0, clean: 0, countdown: 3, paused: false },
  speed: readSpeed(),
  forcedLowQuality: false,

  hydrate: async () => {
    const [settings, sessions] = await Promise.all([loadSettings(), loadSessions()]);
    set({
      ready: true,
      settings,
      sessions,
      heroId: HEROES.some((h) => h.id === settings.lastHeroId) ? settings.lastHeroId : HEROES[0].id,
      streak: computeStreak(sessions),
      totalStars: totalStars(sessions),
    });
  },

  go: (screen) => set({ screen }),

  selectHero: (heroId) => {
    set({ heroId });
    get().updateSettings({ lastHeroId: heroId });
  },

  selectSuit: (heroId, suitId) => {
    const suits = { ...get().settings.suits, [heroId]: suitId };
    get().updateSettings({ suits });
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void saveSettings(settings);
  },

  setHud: (patch) => set((s) => ({ hud: { ...s.hud, ...patch } })),

  setForcedLowQuality: (v) => set({ forcedLowQuality: v }),

  beginSession: () => set({ lastResult: null }),

  refreshStreak: () => set((s) => ({ streak: computeStreak(s.sessions) })),

  finishSession: async (elapsed, completed, startedAt) => {
    const { heroId, settings, sessions } = get();
    const { dateKey: key, slot } = sessionTimeInfo(startedAt);
    const sessionsToday = sessions.filter((s) => s.dateKey === key);
    const otherSlotDone = sessionsToday.some((s) => s.completed && s.slot !== slot);
    const stars = computeStars({ elapsed, completed, slot, sessionsToday });
    const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
    const suitId = settings.suits[heroId] ?? hero.suits[0].id;

    const unlockedBefore = hero.suits.map((_, i) => isSuitUnlocked(sessions, heroId, i));
    let next = sessions;
    if (elapsed >= MIN_RECORD_SECONDS) {
      const record: SessionRecord = {
        startedAt,
        dateKey: key,
        slot,
        heroId,
        suitId,
        elapsed: Math.round(elapsed),
        completed,
        stars,
      };
      await addSession(record);
      next = [...sessions, record];
    }
    let unlockedSuit: SessionResult['unlockedSuit'] = null;
    hero.suits.forEach((suit, i) => {
      if (!unlockedBefore[i] && isSuitUnlocked(next, heroId, i)) {
        unlockedSuit = { heroId, suitId: suit.id };
      }
    });
    const streak = computeStreak(next);
    const result: SessionResult = { stars, elapsed, completed, heroId, slot, otherSlotDone, unlockedSuit, streak };
    set({ sessions: next, streak, totalStars: totalStars(next), lastResult: result });
    return result;
  },

  resetAllData: async () => {
    await clearAllData();
    // keep the language the parent chose; everything else goes back to defaults
    const settings = { ...DEFAULT_SETTINGS, lang: get().settings.lang };
    set({ sessions: [], streak: EMPTY_STREAK, totalStars: 0, settings, lastResult: null });
    void saveSettings(settings);
  },

  effectiveQuality: () => (get().forcedLowQuality ? 'low' : get().settings.quality),
}));

export const selectHeroPack = (s: AppState) => HEROES.find((h) => h.id === s.heroId) ?? HEROES[0];
