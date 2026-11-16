// Message shapes between the parts of the extension.
//
//   page script  <-- window.postMessage -->  bridge  <-- chrome.runtime -->  background
//                                              ^
//                                              +-- chrome.tabs.sendMessage -- popup

import type { PageGame } from '../core/detect';
import type { Preset } from '../core/preset';
import type { GameInfo, ResolveReason } from '../core/resolve';
import type { Settings } from './settings';

/** Marks window messages as ours. Anything without it is ignored. */
export const CHANNEL = 'ghostrol:v1';

export type Mode = 'emulate' | 'native' | 'off';

/** Everything the page script needs to run. Sent by the bridge whenever it changes. */
export interface PageConfig {
  mode: Mode;
  preset: Preset;
  reason: ResolveReason;
  game: GameInfo | null;
  playing: boolean;
  settings: Pick<Settings, 'rawMouse' | 'hints' | 'controllerHandoff' | 'hud' | 'hudCorner'>;
  /** Base URL for extension assets such as fonts, which the page script cannot look up. */
  assetBase: string;
  shortcuts: Shortcuts;
  /** Presets offered in the in-game panel, best match first. */
  choices: PresetChoice[];
  /** The user picked the preset for this game, rather than it being chosen automatically. */
  assigned: boolean;
  /** Name of the preset that Automatic picks for this game. */
  automaticName: string;
}

/** Keyboard shortcuts as the user set them in Chrome, such as "Alt+K". Empty when unset. */
export interface Shortcuts {
  toggle: string;
  nextPreset: string;
  controls: string;
}

export interface PresetChoice {
  id: string;
  name: string;
}

/** What the page script reports back. */
export interface PageStatus {
  /** The virtual controller is what the site sees right now. */
  active: boolean;
  /** The mouse is captured for the game. */
  captured: boolean;
  /** A real controller took over. */
  handedOff: boolean;
  /** Xbox's own mouse and keyboard mode asked for the mouse in this session. */
  nativeSeen: boolean;
}

export type ToPage =
  | { channel: typeof CHANNEL; type: 'config'; config: PageConfig }
  | { channel: typeof CHANNEL; type: 'command'; command: PageCommand };

export type FromPage =
  | { channel: typeof CHANNEL; type: 'hello' }
  | { channel: typeof CHANNEL; type: 'status'; status: PageStatus }
  | { channel: typeof CHANNEL; type: 'native-detected' }
  | { channel: typeof CHANNEL; type: 'shortcut'; command: BridgeCommand }
  | { channel: typeof CHANNEL; type: 'use-preset'; presetId: string | null }
  | { channel: typeof CHANNEL; type: 'mouse-speed'; sensitivity: number };

/** Commands for the page: let go of the mouse, or a shortcut that came through Chrome. */
export type PageCommand = 'release' | 'controls' | BridgeCommand;

/** Commands the bridge carries out, from Chrome shortcuts or keys pressed in the page. */
export type BridgeCommand = 'toggle' | 'next-preset';

/** A message without its channel tag, which the sender adds. */
export type Unsent<T> = T extends unknown ? Omit<T, 'channel'> : never;

/** Bridge to background. */
export type ToBackground =
  | { type: 'resolve'; page: PageGame | null }
  | { type: 'cycle-preset'; page: PageGame | null; currentId: string }
  | { type: 'session'; active: boolean }
  | { type: 'mouse-speed'; page: PageGame | null; presetId: string; sensitivity: number };

export interface ResolveResponse {
  game: GameInfo | null;
  preset: Preset;
  reason: ResolveReason;
  settings: Settings;
  /** The stored choice for native mouse games, if any. */
  nativePreference?: 'native' | 'emulate';
  shortcuts: Shortcuts;
  /** Presets worth offering for this game, best match first. */
  choices: PresetChoice[];
  /** Name of the preset that Automatic picks. */
  automaticName: string;
}

/** Popup or background to bridge. */
export type ToBridge =
  { type: 'get-session' } | { type: 'command'; command: BridgeCommand | 'controls' };

export interface SessionInfo {
  url: string;
  page: PageGame | null;
  game: GameInfo | null;
  presetId: string;
  presetName: string;
  reason: ResolveReason;
  mode: Mode;
  status: PageStatus;
  /** Session-only pause from the toggle shortcut. */
  paused: boolean;
}

export function isFromPage(data: unknown): data is FromPage {
  return (
    typeof data === 'object' && data !== null && (data as { channel?: unknown }).channel === CHANNEL
  );
}
