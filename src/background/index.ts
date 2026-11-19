// Background service worker. Holds the catalog and preset logic so the content scripts
// stay small, handles keyboard shortcuts, and opens the welcome page on install.

import { candidatePresets, resolvePreset, type ResolveContext } from '../core/resolve';
import type { Preset } from '../core/preset';
import type { PageGame } from '../core/detect';
import { builtinPresets, describeGame } from '../data/library';
import type { ResolveResponse, Shortcuts, ToBackground, ToBridge } from '../shared/messages';
import { loadState, setAssignment, type StoredState } from '../shared/storage';
import { editPreset } from '../ui/library';
import { BRAND } from '../shared/brand';

async function context(): Promise<{ state: StoredState; ctx: ResolveContext }> {
  const state = await loadState();
  const presets = new Map<string, Preset>(builtinPresets());
  for (const preset of state.presets) presets.set(preset.id, preset);
  return {
    state,
    ctx: {
      presets,
      assignments: state.assignments,
      defaultPresetId: state.settings.defaultPresetId,
      autoDetect: state.settings.autoDetect,
    },
  };
}

async function shortcuts(): Promise<Shortcuts> {
  const commands = await chrome.commands.getAll();
  const get = (name: string) => commands.find((c) => c.name === name)?.shortcut ?? '';
  return { toggle: get('toggle'), nextPreset: get('next-preset'), controls: get('controls') };
}

async function resolve(page: PageGame | null): Promise<ResolveResponse> {
  const [{ state, ctx }, keys] = await Promise.all([context(), shortcuts()]);
  const game = describeGame(page);
  const { preset, reason } = resolvePreset(game, ctx);
  const automatic = resolvePreset(game, { ...ctx, assignments: {} }).preset;
  const response: ResolveResponse = {
    game,
    preset,
    reason,
    settings: state.settings,
    shortcuts: keys,
    choices: candidatePresets(game, ctx, state.presets).map((p) => ({ id: p.id, name: p.name })),
    automaticName: automatic.name,
  };
  const pref = game ? state.nativePrefs[game.key] : undefined;
  if (pref) response.nativePreference = pref;
  return response;
}

async function cyclePreset(page: PageGame | null, currentId: string): Promise<void> {
  const game = describeGame(page);
  if (!game) return;
  const { state, ctx } = await context();
  const options = candidatePresets(game, ctx, state.presets);
  if (options.length < 2) return;
  const index = options.findIndex((p) => p.id === currentId);
  const next = options[(index + 1) % options.length];
  if (next) await setAssignment(game.key, next.id);
}

/** Mouse speed changed in the game. Built-in presets get a personal copy for the game. */
async function setMouseSpeed(
  page: PageGame | null,
  presetId: string,
  sensitivity: number,
): Promise<void> {
  const { ctx } = await context();
  const preset = ctx.presets.get(presetId);
  if (!preset) return;
  const game = describeGame(page);
  await editPreset(preset, (draft) => (draft.mouse.sensitivity = sensitivity), game?.key);
}

chrome.runtime.onMessage.addListener((message: ToBackground, sender, reply) => {
  switch (message.type) {
    case 'resolve':
      resolve(message.page).then(reply, () => reply(null));
      return true;
    case 'cycle-preset':
      cyclePreset(message.page, message.currentId).then(
        () => reply(true),
        () => reply(false),
      );
      return true;
    case 'mouse-speed':
      setMouseSpeed(message.page, message.presetId, message.sensitivity).then(
        () => reply(true),
        () => reply(false),
      );
      return true;
    case 'session': {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        void chrome.action.setBadgeText({ tabId, text: message.active ? 'on' : '' });
      }
      return false;
    }
  }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle' && command !== 'next-preset' && command !== 'controls') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;
  const message: ToBridge = { type: 'command', command };
  chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
});

chrome.runtime.onInstalled.addListener((details) => {
  void chrome.action.setBadgeBackgroundColor({ color: '#f2b13a' });
  void chrome.action.setBadgeTextColor?.({ color: '#2b1d04' });
  // Chrome opens this page after removal. The extension itself sends nothing (D32).
  void chrome.runtime.setUninstallURL(BRAND.uninstallUrl);
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('studio.html#welcome') });
  }
});
