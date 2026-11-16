// Built-in presets: genre layouts and tuned game presets. Kept apart from the catalog so
// views that only need presets, such as the popup, stay small.

import type { Preset } from '../core/preset';
import { normalizeTitle } from '../core/titles';
import { ARCHETYPE_IDS, archetypePreset } from './archetypes';
import { GAMES, gamePreset } from './games';

let builtins: Map<string, Preset> | undefined;
let tunedByTitle: Map<string, string[]> | undefined;

function build(): void {
  builtins = new Map();
  tunedByTitle = new Map();
  for (const id of ARCHETYPE_IDS) {
    const preset = archetypePreset(id);
    builtins.set(preset.id, preset);
  }
  for (const spec of GAMES) {
    const preset = gamePreset(spec);
    builtins.set(preset.id, preset);
    for (const title of spec.titles) {
      const key = normalizeTitle(title);
      const list = tunedByTitle.get(key) ?? [];
      list.push(preset.id);
      tunedByTitle.set(key, list);
    }
  }
}

export function builtinPresets(): ReadonlyMap<string, Preset> {
  if (!builtins) build();
  return builtins!;
}

export function isBuiltinId(id: string): boolean {
  return id.startsWith('layout:') || id.startsWith('game:');
}

/** Tuned presets for a title, default first. Editions of a game share them. */
export function tunedPresetIds(title: string): string[] {
  if (!tunedByTitle) build();
  return tunedByTitle!.get(normalizeTitle(title)) ?? [];
}
