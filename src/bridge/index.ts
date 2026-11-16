// Content script in the extension's isolated world. It connects the page script, which
// cannot use extension APIs, to storage and the background worker. It watches the URL to
// detect the game, asks the background for the right preset and passes it to the page.

import { isPlaying, parseGameUrl, type PageGame } from '../core/detect';
import {
  CHANNEL,
  isFromPage,
  type BridgeCommand,
  type Mode,
  type PageConfig,
  type PageStatus,
  type ResolveResponse,
  type SessionInfo,
  type ToBackground,
  type ToBridge,
  type ToPage,
  type Unsent,
} from '../shared/messages';
import {
  onStateChanged,
  recordRecent,
  setAssignment,
  setNativePreference,
  saveSettings,
  loadStats,
  updateStats,
} from '../shared/storage';

/** URL check when the Navigation API is missing. */
const URL_POLL_MS = 500;
/** URL check when navigation events are available, only to catch a missed event. */
const URL_SAFETY_MS = 3000;

let page: PageGame | null = parseGameUrl(location.href);
let url = location.href;
let resolved: ResolveResponse | null = null;
let paused = false;
let nativeSeen = false;
let status: PageStatus = { active: false, captured: false, handedOff: false, nativeSeen: false };
let recordedFor = '';
let requestId = 0;

function send<T>(message: ToBackground): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function toPage(message: Unsent<ToPage>): void {
  window.postMessage({ channel: CHANNEL, ...message }, location.origin);
}

function mode(): Mode {
  if (!resolved || !resolved.settings.enabled || paused) return 'off';
  const nativeGame = !!resolved.game?.nativeMouse || nativeSeen;
  if (nativeGame && resolved.nativePreference !== 'emulate') return 'native';
  return 'emulate';
}

/** Sends the current config. Safe to call often; the page ignores repeats. */
function pushConfig(): void {
  if (!resolved) return;
  const { settings } = resolved;
  const config: PageConfig = {
    mode: mode(),
    preset: resolved.preset,
    reason: resolved.reason,
    game: resolved.game,
    playing: isPlaying(page),
    settings: {
      rawMouse: settings.rawMouse,
      hints: settings.hints,
      controllerHandoff: settings.controllerHandoff,
      hud: settings.hud,
      hudCorner: settings.hudCorner,
    },
    assetBase: chrome.runtime.getURL(''),
    shortcuts: resolved.shortcuts,
    choices: resolved.choices,
    assigned: resolved.reason === 'assigned',
    automaticName: resolved.automaticName,
  };
  toPage({ type: 'config', config });
}

async function resolve(): Promise<void> {
  const id = ++requestId;
  try {
    const response = await send<ResolveResponse>({ type: 'resolve', page });
    if (id !== requestId) return; // A newer request is on its way.
    resolved = response;
    pushConfig();
    await noteSession();
  } catch {
    // The extension was reloaded or updated. This tab keeps its last config until reload.
  }
}

/** Records the game once per play session, for the recent list and review prompt. */
async function noteSession(): Promise<void> {
  if (!resolved?.game || page?.kind !== 'stream' || recordedFor === url) return;
  recordedFor = url;
  await recordRecent(resolved.game);
  const stats = await loadStats();
  await updateStats({ sessions: stats.sessions + 1 });
}

function onUrlChange(): void {
  if (location.href === url) return;
  url = location.href;
  page = parseGameUrl(url);
  nativeSeen = false;
  void resolve();
}

async function toggle(): Promise<void> {
  if (!resolved) return;
  const current = mode();
  if (!resolved.settings.enabled) {
    await saveSettings({ enabled: true });
  } else if (current === 'native' && resolved.game) {
    await setNativePreference(resolved.game.key, 'emulate');
  } else {
    paused = current === 'emulate';
    pushConfig();
  }
}

function runCommand(command: BridgeCommand): void {
  if (command === 'toggle') void toggle();
  else if (command === 'next-preset' && resolved) {
    void send({ type: 'cycle-preset', page, currentId: resolved.preset.id }).catch(() => undefined);
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || !isFromPage(event.data)) return;
  const data = event.data;
  if (data.type === 'hello') {
    pushConfig();
  } else if (data.type === 'status') {
    const wasActive = status.active;
    status = data.status;
    if (status.active !== wasActive)
      void send({ type: 'session', active: status.active }).catch(() => undefined);
  } else if (data.type === 'native-detected' && !nativeSeen) {
    nativeSeen = true;
    pushConfig();
  } else if (data.type === 'shortcut') {
    runCommand(data.command);
  } else if (data.type === 'use-preset' && resolved?.game) {
    // Any script on the page can post here, so only accept a preset the panel offered,
    // or null for Automatic. Anything else would land in synced storage unchecked.
    const id = data.presetId;
    const offered = id === null || resolved.choices.some((c) => c.id === id);
    if (offered) void setAssignment(resolved.game.key, id);
  } else if (
    data.type === 'mouse-speed' &&
    resolved &&
    typeof data.sensitivity === 'number' &&
    Number.isFinite(data.sensitivity)
  ) {
    void send({
      type: 'mouse-speed',
      page,
      presetId: resolved.preset.id,
      sensitivity: data.sensitivity,
    }).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message: ToBridge, _sender, reply) => {
  if (message.type === 'get-session') {
    const info: SessionInfo | null = resolved && {
      url,
      page,
      game: resolved.game,
      presetId: resolved.preset.id,
      presetName: resolved.preset.name,
      reason: resolved.reason,
      mode: mode(),
      status,
      paused,
    };
    reply(info);
    return false;
  }
  if (message.type === 'command') {
    // The page may have seen the same key press itself. It decides, and sends the
    // shortcut back if it did not.
    toPage({ type: 'command', command: message.command });
    reply(true);
  }
  return false;
});

onStateChanged(() => void resolve());
window.addEventListener('popstate', onUrlChange);
// xbox.com changes pages with history.pushState. The Navigation API reports those right
// away; a slow check stays as a safety net in case an event is ever missed.
const navigation = (globalThis as { navigation?: EventTarget }).navigation;
navigation?.addEventListener('currententrychange', onUrlChange);
setInterval(onUrlChange, navigation ? URL_SAFETY_MS : URL_POLL_MS);
void resolve();
