// Preset helpers shared by the popup and the Studio.

import type { Preset } from '../core/preset';
import { clonePreset } from '../core/preset';
import { builtinPresets, isBuiltinId } from '../data/presets';
import { newPresetId, savePreset, setAssignment, type StoredState } from '../shared/storage';

export function presetMap(state: StoredState): Map<string, Preset> {
  const map = new Map<string, Preset>(builtinPresets());
  for (const preset of state.presets) map.set(preset.id, preset);
  return map;
}

export { isBuiltinId };
export { TARGET_GROUPS, type TargetGroup } from '../core/targets';

/** Built-in presets are read-only. Editing one makes a personal copy first. */
export function copyForEditing(preset: Preset): Preset {
  const copy = clonePreset(preset);
  copy.id = newPresetId();
  copy.name = `${preset.name} (mine)`.slice(0, 48);
  copy.basedOn = preset.id;
  delete copy.updatedAt;
  return copy;
}

/**
 * Applies a change to a preset. Built-in presets are copied first, and when a game is
 * given, the copy becomes that game's preset so the change takes effect right away.
 */
export async function editPreset(
  preset: Preset,
  change: (draft: Preset) => void,
  gameKey?: string,
): Promise<Preset> {
  const draft = isBuiltinId(preset.id) ? copyForEditing(preset) : clonePreset(preset);
  change(draft);
  await savePreset(draft);
  if (gameKey && isBuiltinId(preset.id)) await setAssignment(gameKey, draft.id);
  return draft;
}

export { REASON_TEXT } from '../core/resolve';
