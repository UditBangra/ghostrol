// The preset format: what each input does, how the mouse behaves, and how keys
// imitate analog sticks and triggers. Presets come from three places (built-in data,
// the user's own edits, and imported files), so everything entering the system goes
// through sanitizePreset.

import { BUTTONS, isTarget, type Button, type Target } from './targets';
import { isInputCode, isMouseCode, type InputCode } from './inputs';

export type Bindings = Partial<Record<Target, InputCode[]>>;
export type Labels = Partial<Record<Target, string>>;

export type MouseTarget = 'right' | 'left' | 'none';
export type MouseMode = 'camera' | 'wheel';

export interface MouseSettings {
  /** Which stick the mouse drives. */
  target: MouseTarget;
  /** camera: mouse speed tilts the stick. wheel: mouse position is the stick position (X only). */
  mode: MouseMode;
  /** 1 to 100. */
  sensitivity: number;
  /** Vertical speed relative to horizontal. */
  yRatio: number;
  invertY: boolean;
  /** Response exponent. Below 1 makes small movements stronger. */
  curve: number;
  /** Minimum stick deflection once the mouse moves, to get past the game's own dead zone. */
  antiDeadzone: number;
  /** 0 is raw, higher values smooth out jitter at the cost of a little delay. */
  smoothing: number;
  /** Wheel mode only: how quickly the wheel returns to center. 0 holds its position. */
  wheelReturn: number;
}

export interface AnalogSettings {
  /** Time for a key to push a stick from center to full. 0 is instant. */
  stickRampMs: number;
  /** Time for a key to press a trigger fully. 0 is instant. */
  triggerRampMs: number;
  /** Stick and trigger scale while the precision key is held. */
  precision: number;
}

export type ArchetypeId =
  | 'shooter'
  | 'action'
  | 'racing'
  | 'sports'
  | 'fighting'
  | 'platformer'
  | 'rpg'
  | 'strategy'
  | 'flight'
  | 'twinstick'
  | 'menu';

export interface Preset {
  id: string;
  name: string;
  bindings: Bindings;
  /** What each control does in this game, shown next to the key. */
  labels: Labels;
  /** Buttons that latch on press and release on the next press. */
  toggles: Button[];
  mouse: MouseSettings;
  analog: AnalogSettings;
  /** The layout family this preset belongs to. */
  archetype?: ArchetypeId;
  /** The preset this one was copied from, if any. */
  basedOn?: string;
  notes?: string;
  updatedAt?: number;
}

export const DEFAULT_MOUSE: Readonly<MouseSettings> = Object.freeze({
  target: 'right',
  mode: 'camera',
  sensitivity: 40,
  yRatio: 1,
  invertY: false,
  curve: 0.85,
  antiDeadzone: 0.12,
  smoothing: 0.25,
  wheelReturn: 0,
});

export const DEFAULT_ANALOG: Readonly<AnalogSettings> = Object.freeze({
  stickRampMs: 0,
  triggerRampMs: 0,
  precision: 0.45,
});

export const LIMITS = {
  sensitivity: [1, 100],
  yRatio: [0.25, 4],
  curve: [0.4, 1.6],
  antiDeadzone: [0, 0.5],
  smoothing: [0, 0.9],
  wheelReturn: [0, 1],
  stickRampMs: [0, 1000],
  triggerRampMs: [0, 1000],
  precision: [0.1, 0.9],
} as const satisfies Record<string, readonly [number, number]>;

/** Chords bind several keys to one button (Warframe binds five keys to the ability button). */
export const MAX_INPUTS_PER_TARGET = 8;
export const MAX_NAME_LENGTH = 48;
export const MAX_LABEL_LENGTH = 40;

const ARCHETYPES: ReadonlySet<string> = new Set<ArchetypeId>([
  'shooter',
  'action',
  'racing',
  'sports',
  'fighting',
  'platformer',
  'rpg',
  'strategy',
  'flight',
  'twinstick',
  'menu',
]);

function clamp(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return text || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeMouse(raw: unknown): MouseSettings {
  const m = isRecord(raw) ? raw : {};
  const d = DEFAULT_MOUSE;
  return {
    target: m.target === 'left' || m.target === 'none' ? m.target : 'right',
    mode: m.mode === 'wheel' ? 'wheel' : 'camera',
    sensitivity: clamp(m.sensitivity, LIMITS.sensitivity, d.sensitivity),
    yRatio: clamp(m.yRatio, LIMITS.yRatio, d.yRatio),
    invertY: m.invertY === true,
    curve: clamp(m.curve, LIMITS.curve, d.curve),
    antiDeadzone: clamp(m.antiDeadzone, LIMITS.antiDeadzone, d.antiDeadzone),
    smoothing: clamp(m.smoothing, LIMITS.smoothing, d.smoothing),
    wheelReturn: clamp(m.wheelReturn, LIMITS.wheelReturn, d.wheelReturn),
  };
}

export function sanitizeAnalog(raw: unknown): AnalogSettings {
  const a = isRecord(raw) ? raw : {};
  const d = DEFAULT_ANALOG;
  return {
    stickRampMs: Math.round(clamp(a.stickRampMs, LIMITS.stickRampMs, d.stickRampMs)),
    triggerRampMs: Math.round(clamp(a.triggerRampMs, LIMITS.triggerRampMs, d.triggerRampMs)),
    precision: clamp(a.precision, LIMITS.precision, d.precision),
  };
}

export function sanitizeBindings(raw: unknown): Bindings {
  const out: Bindings = {};
  if (!isRecord(raw)) return out;
  for (const [target, codes] of Object.entries(raw)) {
    if (!isTarget(target) || !Array.isArray(codes)) continue;
    const clean = [...new Set(codes.filter(isInputCode))].slice(0, MAX_INPUTS_PER_TARGET);
    if (clean.length) out[target] = clean;
  }
  return out;
}

function sanitizeLabels(raw: unknown): Labels {
  const out: Labels = {};
  if (!isRecord(raw)) return out;
  for (const [target, label] of Object.entries(raw)) {
    const text = cleanText(label, MAX_LABEL_LENGTH);
    if (isTarget(target) && text) out[target] = text;
  }
  return out;
}

const BUTTON_SET: ReadonlySet<string> = new Set(BUTTONS);

/** Returns a valid preset built from untrusted data, or null if it cannot be one. */
export function sanitizePreset(raw: unknown): Preset | null {
  if (!isRecord(raw)) return null;
  const id = cleanText(raw.id, 80);
  const name = cleanText(raw.name, MAX_NAME_LENGTH);
  if (!id || !name) return null;
  const preset: Preset = {
    id,
    name,
    bindings: sanitizeBindings(raw.bindings),
    labels: sanitizeLabels(raw.labels),
    toggles: Array.isArray(raw.toggles)
      ? [...new Set(raw.toggles.filter((t): t is Button => BUTTON_SET.has(t as string)))]
      : [],
    mouse: sanitizeMouse(raw.mouse),
    analog: sanitizeAnalog(raw.analog),
  };
  if (typeof raw.archetype === 'string' && ARCHETYPES.has(raw.archetype)) {
    preset.archetype = raw.archetype as ArchetypeId;
  }
  const basedOn = cleanText(raw.basedOn, 80);
  if (basedOn) preset.basedOn = basedOn;
  const notes = cleanText(raw.notes, 280);
  if (notes) preset.notes = notes;
  if (typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)) {
    preset.updatedAt = raw.updatedAt;
  }
  return preset;
}

export function clonePreset(preset: Preset): Preset {
  return structuredClone(preset);
}

/** The preset looks around with the mouse, or binds a mouse button or the wheel. */
export function usesMouse(preset: Preset): boolean {
  if (preset.mouse.target !== 'none') return true;
  return Object.values(preset.bindings).some((codes) => codes?.some(isMouseCode));
}

/** The file format for sharing a preset. */
export const PRESET_FILE_FORMAT = 'ghostrol.preset';
/** Accepted on import, including files saved before the rename. */
const PRESET_FORMATS: readonly unknown[] = [PRESET_FILE_FORMAT, 'fauxpad.preset'];
export const PRESET_FILE_VERSION = 1;

export interface PresetFile {
  format: typeof PRESET_FILE_FORMAT;
  version: number;
  preset: Preset;
}

export function toPresetFile(preset: Preset): PresetFile {
  return { format: PRESET_FILE_FORMAT, version: PRESET_FILE_VERSION, preset };
}

/** Reads a shared preset file, accepting a bare preset object as well. */
export function fromPresetFile(raw: unknown): Preset | null {
  if (isRecord(raw) && PRESET_FORMATS.includes(raw.format)) return sanitizePreset(raw.preset);
  return sanitizePreset(raw);
}
