// Runs inside the xbox.com page before the site loads (MAIN world, document_start).
// It installs the virtual controller right away but keeps it hidden until the bridge
// sends a configuration, so a real controller keeps working until there is a preset
// to play with.

import { InputEngine } from '../core/engine';
import type { InputCode, LayoutMap } from '../core/inputs';
import { usesMouse } from '../core/preset';
import { REASON_TEXT } from '../core/resolve';
import { matchesShortcut, parseShortcut, type Shortcut } from '../core/shortcuts';
import { TARGET_NAMES } from '../core/targets';
import { BRAND } from '../shared/brand';
import {
  CHANNEL,
  type FromPage,
  type PageCommand,
  type PageConfig,
  type PageStatus,
  type ToPage,
  type Unsent,
} from '../shared/messages';
import { InputCapture } from './capture';
import { setMarkUrl } from './dom';
import { Overlay } from './overlay';
import type { PanelData } from './panel';
import { GamepadShim } from './shim';

/** Holding the controls shortcut longer than this makes it a peek that closes on release. */
const PEEK_MS = 300;
/**
 * A shortcut can arrive twice: as keys in the page, and from Chrome. Which ones Chrome
 * sees first differs between windowed and full screen, so the page keeps track of what
 * it handled and ignores the Chrome copy within this time.
 */
const DUPLICATE_MS = 1500;
/** Mouse speed is saved once the buttons have been left alone this long. */
const SPEED_SAVE_MS = 400;

const shim = new GamepadShim();
const capture = new InputCapture();
const overlay = new Overlay();
let engine: InputEngine | null = null;
let config: PageConfig | null = null;
let lastStatus = '';
let nativeSeen = false;
let layout: LayoutMap | undefined;
let shortcuts: { toggle: Shortcut | null; next: Shortcut | null; controls: Shortcut | null } = {
  toggle: null,
  next: null,
  controls: null,
};
/** The key that opened the panel and is still held, for peeking. */
let peekKey: string | null = null;
let peekSince = 0;
const handledAt = new Map<PageCommand, number>();
let speedTimer = 0;

capture.install();

(navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<LayoutMap> } }).keyboard
  ?.getLayoutMap?.()
  .then((map) => (layout = map))
  .catch(() => undefined);

function post(message: Unsent<FromPage>): void {
  window.postMessage({ channel: CHANNEL, ...message }, window.location.origin);
}

function emulating(c: PageConfig | null = config): c is PageConfig {
  return !!c && c.mode === 'emulate' && c.playing;
}

function reportStatus(): void {
  const status: PageStatus = {
    active: shim.isExposed,
    captured: capture.isCaptured,
    handedOff: shim.isHandedOff,
    nativeSeen,
  };
  const key = JSON.stringify(status);
  if (key === lastStatus) return;
  lastStatus = key;
  post({ type: 'status', status });
  updatePrompt();
}

function updatePrompt(): void {
  const c = config;
  const show =
    emulating(c) &&
    usesMouse(c.preset) &&
    !capture.isCaptured &&
    !shim.isHandedOff &&
    !overlay.panel.isOpen;
  overlay.showPrompt(show);
}

function announce(next: PageConfig, previous: PageConfig | null): void {
  if (!next.settings.hints || !next.playing) return;
  const modeChanged = next.mode !== previous?.mode;
  const presetChanged =
    next.preset.id !== previous?.preset.id || next.preset.updatedAt !== previous?.preset.updatedAt;
  const key = next.shortcuts.toggle;
  const name = BRAND.name;

  if (modeChanged && next.mode === 'native') {
    overlay.say(
      key
        ? `This game has its own mouse and keyboard support, so ${name} is standing by. Press **${key}** to use ${name} instead.`
        : `This game has its own mouse and keyboard support, so ${name} is standing by.`,
    );
  } else if (modeChanged && next.mode === 'off' && previous?.mode === 'emulate') {
    overlay.say(
      key ? `${name} is paused. Press **${key}** to turn it back on.` : `${name} is paused.`,
    );
  } else if ((modeChanged || presetChanged) && next.mode === 'emulate') {
    const game = next.game?.title;
    const controls = next.shortcuts.controls;
    const tip = modeChanged && controls ? ` **${controls}** shows the keys.` : '';
    overlay.say(
      next.reason === 'tuned' || !game
        ? `Playing with the **${next.preset.name}** preset.${tip}`
        : `Playing **${game}** with the **${next.preset.name}**.${tip}`,
    );
  }
}

function panelData(c: PageConfig): PanelData {
  return {
    title: c.game?.title ?? 'Controls',
    reason: REASON_TEXT[c.reason],
    preset: c.preset,
    layout,
    choices: c.choices,
    pickedId: c.assigned ? c.preset.id : null,
    automaticName: c.automaticName,
    shortcuts: c.shortcuts,
    brand: BRAND.name,
  };
}

function openPanel(peek: boolean): void {
  const c = config;
  if (!emulating(c) || !overlay.ensure()) return;
  overlay.panel.open(panelData(c), peek);
  // A peek is only a picture; the game keeps the mouse. Otherwise the panel needs clicks.
  if (!peek) capture.suspend(true);
  updatePrompt();
}

function keepPanelOpen(): void {
  overlay.panel.setPeek(false);
  capture.suspend(true);
}

function closePanel(backToGame: boolean): void {
  peekKey = null;
  if (!overlay.panel.isOpen) return;
  overlay.panel.close();
  capture.suspend(false);
  // The click on "Back to game" counts as the click that captures the mouse.
  if (backToGame && config && usesMouse(config.preset)) capture.capture();
  updatePrompt();
}

/** A shortcut that came through Chrome. Without a key up, the panel cannot be a peek. */
function onCommand(command: PageCommand): void {
  if (command === 'release') return capture.release();
  if (performance.now() - (handledAt.get(command) ?? -Infinity) < DUPLICATE_MS) return;
  if (command !== 'controls') post({ type: 'shortcut', command });
  else if (overlay.panel.isOpen) closePanel(false);
  else openPanel(false);
}

/** Shortcuts, Esc for the panel and the end of a peek. Returns true when the key was used. */
function filterKey(event: KeyboardEvent): boolean {
  const c = config;
  if (!c) return false;
  const down = event.type === 'keydown';

  if (peekKey && event.code === peekKey) {
    if (down) return true;
    peekKey = null;
    // Event times, not handler times: drawing the panel can delay the key up.
    if (event.timeStamp - peekSince < PEEK_MS) keepPanelOpen();
    else closePanel(false);
    return true;
  }
  if (overlay.panel.isOpen && event.code === 'Escape') {
    if (down) closePanel(false);
    return true;
  }
  if (!down) return false;

  if (matchesShortcut(shortcuts.toggle, event)) {
    if (!event.repeat) shortcut('toggle');
    return true;
  }
  if (!c.game) return false;
  if (matchesShortcut(shortcuts.next, event)) {
    if (!event.repeat) shortcut('next-preset');
    return true;
  }
  if (matchesShortcut(shortcuts.controls, event) && emulating(c)) {
    if (event.repeat) return true;
    handledAt.set('controls', performance.now());
    if (overlay.panel.isOpen) {
      closePanel(false);
    } else {
      openPanel(true);
      peekKey = event.code;
      peekSince = event.timeStamp;
    }
    return true;
  }
  return false;
}

function shortcut(command: 'toggle' | 'next-preset'): void {
  handledAt.set(command, performance.now());
  post({ type: 'shortcut', command });
}

function onInput(code: InputCode, down: boolean): void {
  if (!engine || !overlay.hud.showsKeys) return;
  const targets = engine.targetsOf(code);
  if (!targets.length) return;
  const preset = engine.getPreset();
  const first = targets[0]!;
  const label = preset.labels[first] ?? TARGET_NAMES[first];
  overlay.hud.key(code, down, { targets, label }, layout);
}

function applyConfig(next: PageConfig): void {
  const previous = config;
  config = next;
  overlay.setFontUrl(`${next.assetBase}fonts/archivo.woff2`);
  setMarkUrl(`${next.assetBase}icons/128.png`);
  shortcuts = {
    toggle: parseShortcut(next.shortcuts.toggle),
    next: parseShortcut(next.shortcuts.nextPreset),
    controls: parseShortcut(next.shortcuts.controls),
  };

  const samePreset =
    previous?.preset.id === next.preset.id && previous.preset.updatedAt === next.preset.updatedAt;
  if (!engine) engine = new InputEngine(next.preset);
  else if (!samePreset) engine.setPreset(next.preset);

  const emulate = emulating(next);
  // Only while playing. On the catalog pages a phantom controller would switch the
  // site's menus into controller mode for no reason.
  shim.configure(engine, emulate, next.settings.controllerHandoff);
  capture.configure(engine, {
    active: emulate,
    rawMouse: next.settings.rawMouse,
    wantsMouse: usesMouse(next.preset),
    exclusive: emulate && !!next.game?.nativeMouse,
  });

  const showHud = emulate && next.settings.hud !== 'off';
  if (showHud) overlay.ensure();
  overlay.hud.configure(
    next.settings.hud,
    next.settings.hudCorner,
    showHud ? () => engine?.state ?? null : null,
  );

  if (!emulate) closePanel(false);
  else overlay.panel.update(panelData(next));

  announce(next, previous);
  reportStatus();
  updatePrompt();
}

shim.onChange = reportStatus;
capture.onChange = reportStatus;
capture.keyFilter = filterKey;
capture.onInput = onInput;
capture.onReset = () => overlay.hud.reset();
capture.onSiteLock = () => {
  if (nativeSeen) return;
  nativeSeen = true;
  post({ type: 'native-detected' });
  reportStatus();
};
overlay.onCaptureClick = () => capture.capture();
// Clicking the game when the preset ignores the mouse would otherwise do nothing at all.
// Say why, once per preset, and where the other presets are.
const toldMouseless = new Set<string>();
capture.onMouselessClick = () => {
  const c = config;
  if (!emulating(c) || !c.settings.hints || toldMouseless.has(c.preset.id)) return;
  toldMouseless.add(c.preset.id);
  const key = c.shortcuts.controls;
  const name = c.preset.name;
  overlay.say(
    key
      ? `**${name}** plays with keys only, so the mouse stays free. **${key}** shows its keys and other presets.`
      : `**${name}** plays with keys only, so the mouse stays free. Other presets are in the ${BRAND.name} button.`,
  );
};
overlay.panel.onBack = () => closePanel(true);
overlay.panel.onPick = (presetId) => post({ type: 'use-preset', presetId });
overlay.panel.onSpeed = (sensitivity) => {
  clearTimeout(speedTimer);
  speedTimer = window.setTimeout(() => post({ type: 'mouse-speed', sensitivity }), SPEED_SAVE_MS);
};

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as ToPage | undefined;
  if (!data || data.channel !== CHANNEL) return;
  if (data.type === 'config') applyConfig(data.config);
  else if (data.type === 'command') onCommand(data.command);
});

post({ type: 'hello' });
