// Extension-wide settings. Stored in chrome.storage.sync so they follow the user.

/** What the in-game display shows: recent key presses, the sticks and triggers, or both. */
export type HudMode = 'off' | 'keys' | 'sticks' | 'both';
export const HUD_MODES: readonly HudMode[] = ['off', 'keys', 'sticks', 'both'];

export type HudCorner = 'left' | 'right';

/** Ember is ordinary fire; ghost is pale, cold spectral fire. */
export type FlameColor = 'ember' | 'ghost';

export interface Settings {
  /** Master switch. Off means the extension does nothing on xbox.com. */
  enabled: boolean;
  /** Pick a preset automatically for each game. */
  autoDetect: boolean;
  /** Used when nothing else matches, or when auto-detect is off. */
  defaultPresetId: string;
  /** Ask the browser for raw mouse movement without OS acceleration. */
  rawMouse: boolean;
  /** Short messages over the game, such as the preset that loaded. */
  hints: boolean;
  /** Switch to a real controller as soon as one is used. */
  controllerHandoff: boolean;
  /** The in-game input display. */
  hud: HudMode;
  /** Bottom corner the input display sits in. */
  hudCorner: HudCorner;
  /** The animated fire around the popup and the Studio welcome. */
  fire: boolean;
  flame: FlameColor;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true,
  autoDetect: true,
  defaultPresetId: 'layout:action',
  rawMouse: true,
  hints: true,
  controllerHandoff: true,
  hud: 'keys',
  hudCorner: 'left',
  fire: true,
  flame: 'ember',
});

export function sanitizeSettings(raw: unknown): Settings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (key: keyof Settings) =>
    typeof s[key] === 'boolean' ? (s[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean);
  return {
    enabled: bool('enabled'),
    autoDetect: bool('autoDetect'),
    defaultPresetId:
      typeof s.defaultPresetId === 'string' && s.defaultPresetId
        ? s.defaultPresetId
        : DEFAULT_SETTINGS.defaultPresetId,
    rawMouse: bool('rawMouse'),
    hints: bool('hints'),
    controllerHandoff: bool('controllerHandoff'),
    hud: HUD_MODES.includes(s.hud as HudMode)
      ? (s.hud as HudMode)
      : // Version 0.1 stored an on or off switch for the stick display.
        s.inputDisplay === true
        ? 'both'
        : DEFAULT_SETTINGS.hud,
    hudCorner: s.hudCorner === 'right' ? 'right' : 'left',
    fire: bool('fire'),
    flame: s.flame === 'ghost' ? 'ghost' : 'ember',
  };
}

/** What to do in games that support mouse and keyboard natively. */
export type NativePreference = 'native' | 'emulate';
