// Persistent state.
//
// Settings, per-game choices and the user's presets live in chrome.storage.sync so they
// follow the user to other computers. Each preset is its own key, which keeps every item
// under the 8 KB sync limit. If sync is full, a preset falls back to local storage
// instead of failing. A full backup can be exported and imported at any time.

import type { GameInfo } from '../core/resolve';
import { sanitizePreset, type Preset } from '../core/preset';
import { sanitizeSettings, type NativePreference, type Settings } from './settings';

const SETTINGS = 'settings';
const ASSIGNMENTS = 'assignments';
const NATIVE = 'nativePrefs';
const PRESET_PREFIX = 'preset:';
const RECENT = 'recent';
const STATS = 'stats';
const MAX_RECENT = 12;

export interface StoredState {
  settings: Settings;
  /** Game key to preset id. */
  assignments: Record<string, string>;
  nativePrefs: Record<string, NativePreference>;
  presets: Preset[];
}

export interface RecentGame {
  key: string;
  title: string;
  productId?: string;
  playedAt: number;
}

export interface Stats {
  sessions: number;
  reviewPrompt: 'pending' | 'dismissed' | 'done';
}

function stringRecord<T extends string>(raw: unknown, allowed?: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    if (allowed && !allowed.includes(value as T)) continue;
    out[key] = value as T;
  }
  return out;
}

function collectPresets(...areas: Record<string, unknown>[]): Preset[] {
  const byId = new Map<string, Preset>();
  for (const area of areas) {
    for (const [key, value] of Object.entries(area)) {
      if (!key.startsWith(PRESET_PREFIX)) continue;
      const preset = sanitizePreset(value);
      if (!preset) continue;
      const existing = byId.get(preset.id);
      if (!existing || (preset.updatedAt ?? 0) > (existing.updatedAt ?? 0))
        byId.set(preset.id, preset);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadState(): Promise<StoredState> {
  const [sync, local] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null),
  ]);
  return {
    settings: sanitizeSettings(sync[SETTINGS]),
    assignments: stringRecord(sync[ASSIGNMENTS]),
    nativePrefs: stringRecord<NativePreference>(sync[NATIVE], ['native', 'emulate']),
    presets: collectPresets(local, sync),
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = sanitizeSettings((await chrome.storage.sync.get(SETTINGS))[SETTINGS]);
  const next = sanitizeSettings({ ...current, ...patch });
  await chrome.storage.sync.set({ [SETTINGS]: next });
  return next;
}

async function updateRecord(key: string, field: string, value: string | null): Promise<void> {
  const current = stringRecord((await chrome.storage.sync.get(key))[key]);
  if (value === null) delete current[field];
  else current[field] = value;
  await chrome.storage.sync.set({ [key]: current });
}

/** Remembers which preset to use for a game. Pass null to go back to automatic. */
export function setAssignment(gameKey: string, presetId: string | null): Promise<void> {
  return updateRecord(ASSIGNMENTS, gameKey, presetId);
}

export function setNativePreference(gameKey: string, pref: NativePreference | null): Promise<void> {
  return updateRecord(NATIVE, gameKey, pref);
}

/** Saves a user preset. Returns where it was stored. */
export async function savePreset(preset: Preset): Promise<'sync' | 'local'> {
  const clean = sanitizePreset({ ...preset, updatedAt: Date.now() });
  if (!clean) throw new Error('That preset is not valid');
  const key = PRESET_PREFIX + clean.id;
  try {
    await chrome.storage.sync.set({ [key]: clean });
    await chrome.storage.local.remove(key);
    return 'sync';
  } catch {
    await chrome.storage.local.set({ [key]: clean });
    await chrome.storage.sync.remove(key).catch(() => undefined);
    return 'local';
  }
}

export async function deletePreset(id: string): Promise<void> {
  const key = PRESET_PREFIX + id;
  await Promise.all([chrome.storage.sync.remove(key), chrome.storage.local.remove(key)]);
  const assignments = stringRecord((await chrome.storage.sync.get(ASSIGNMENTS))[ASSIGNMENTS]);
  let changed = false;
  for (const [game, presetId] of Object.entries(assignments)) {
    if (presetId === id) {
      delete assignments[game];
      changed = true;
    }
  }
  if (changed) await chrome.storage.sync.set({ [ASSIGNMENTS]: assignments });
  const settings = sanitizeSettings((await chrome.storage.sync.get(SETTINGS))[SETTINGS]);
  if (settings.defaultPresetId === id) await saveSettings({ defaultPresetId: 'layout:action' });
}

export function newPresetId(): string {
  return `user:${crypto.randomUUID().slice(0, 8)}`;
}

/** Calls back whenever stored state changes, in any context. Returns an unsubscribe function. */
export function onStateChanged(callback: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    const relevant = Object.keys(changes).some(
      (k) => k === SETTINGS || k === ASSIGNMENTS || k === NATIVE || k.startsWith(PRESET_PREFIX),
    );
    if (relevant) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function loadRecent(): Promise<RecentGame[]> {
  const raw = (await chrome.storage.local.get(RECENT))[RECENT];
  return Array.isArray(raw)
    ? (raw as RecentGame[]).filter((g) => g && typeof g.key === 'string')
    : [];
}

export async function recordRecent(game: GameInfo): Promise<void> {
  const list = (await loadRecent()).filter((g) => g.key !== game.key);
  const entry: RecentGame = { key: game.key, title: game.title, playedAt: Date.now() };
  if (game.productId) entry.productId = game.productId;
  list.unshift(entry);
  await chrome.storage.local.set({ [RECENT]: list.slice(0, MAX_RECENT) });
}

export async function loadStats(): Promise<Stats> {
  const raw = (await chrome.storage.local.get(STATS))[STATS] as Partial<Stats> | undefined;
  return {
    sessions: typeof raw?.sessions === 'number' ? raw.sessions : 0,
    reviewPrompt:
      raw?.reviewPrompt === 'dismissed' || raw?.reviewPrompt === 'done'
        ? raw.reviewPrompt
        : 'pending',
  };
}

export async function updateStats(patch: Partial<Stats>): Promise<void> {
  await chrome.storage.local.set({ [STATS]: { ...(await loadStats()), ...patch } });
}

/** Full backup file. */
export const BACKUP_FORMAT = 'ghostrol.backup';
/** Accepted on import, including backups saved before the rename. */
const BACKUP_FORMATS: readonly unknown[] = [BACKUP_FORMAT, 'fauxpad.backup'];

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  settings: Settings;
  assignments: Record<string, string>;
  nativePrefs: Record<string, NativePreference>;
  presets: Preset[];
}

export async function exportBackup(): Promise<Backup> {
  const state = await loadState();
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), ...state };
}

/** Restores a backup on top of current state. Returns how many presets were restored. */
export async function importBackup(raw: unknown): Promise<number> {
  if (typeof raw !== 'object' || raw === null || !BACKUP_FORMATS.includes((raw as Backup).format)) {
    throw new Error('This file is not a backup from this extension');
  }
  const backup = raw as Partial<Backup>;
  const presets = Array.isArray(backup.presets)
    ? backup.presets.map(sanitizePreset).filter((p): p is Preset => p !== null)
    : [];
  for (const preset of presets) await savePreset(preset);
  await chrome.storage.sync.set({
    [SETTINGS]: sanitizeSettings(backup.settings),
    [ASSIGNMENTS]: stringRecord(backup.assignments),
    [NATIVE]: stringRecord<NativePreference>(backup.nativePrefs, ['native', 'emulate']),
  });
  return presets.length;
}
