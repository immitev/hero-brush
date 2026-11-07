import Dexie, { type EntityTable } from 'dexie';
import type { SessionRecord } from '../game/scoring';

export type QualityTier = 'low' | 'high';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  voiceMuted: boolean;
  quality: QualityTier;
  /** Selected suit per hero id. */
  suits: Record<string, string>;
  lastHeroId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  voiceMuted: false,
  quality: 'high',
  suits: {},
  lastHeroId: 'ironman',
};

interface SettingsRow {
  key: string;
  value: Settings;
}

class HeroBrushDB extends Dexie {
  sessions!: EntityTable<SessionRecord, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor() {
    super('hero-brush');
    this.version(1).stores({
      sessions: '++id, startedAt, dateKey, heroId',
      settings: 'key',
    });
  }
}

export const db = new HeroBrushDB();

export async function loadSettings(): Promise<Settings> {
  try {
    const row = await db.settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(value: Settings): Promise<void> {
  try {
    await db.settings.put({ key: 'settings', value });
  } catch (err) {
    console.warn('settings not saved', err);
  }
}

export async function loadSessions(): Promise<SessionRecord[]> {
  try {
    return await db.sessions.orderBy('startedAt').toArray();
  } catch {
    return [];
  }
}

export async function addSession(record: SessionRecord): Promise<void> {
  try {
    await db.sessions.add(record);
  } catch (err) {
    console.warn('session not saved', err);
  }
}

export async function clearAllData(): Promise<void> {
  await db.sessions.clear();
  await db.settings.clear();
}
