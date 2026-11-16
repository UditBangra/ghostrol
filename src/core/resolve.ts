// Chooses which preset to use for a game. Pure, so it is easy to test.
//
// Order: the preset the user picked for this game, then a preset tuned for the game,
// then the layout for its genre, then the user's default.

import type { ArchetypeId, Preset } from './preset';

export interface GameInfo {
  /** Normalized title, shared by every edition of the game. Used for per-game choices. */
  key: string;
  title: string;
  productId?: string;
  archetype: ArchetypeId;
  /** Xbox lists this game as playable with mouse and keyboard natively. */
  nativeMouse: boolean;
  /** Built-in presets made for this game, default first. */
  tunedIds: string[];
  /** Position in the cloud popularity list, when the game is in the catalog. */
  rank?: number;
}

export type ResolveReason = 'assigned' | 'tuned' | 'genre' | 'default';

/** Why a preset was chosen, in words for the interface. */
export const REASON_TEXT: Readonly<Record<ResolveReason, string>> = {
  assigned: 'Your pick for this game',
  tuned: 'Made for this game',
  genre: 'Picked from the genre',
  default: 'Your default',
};

export interface ResolveContext {
  presets: ReadonlyMap<string, Preset>;
  /** Game key to preset id. */
  assignments: Readonly<Record<string, string>>;
  defaultPresetId: string;
  autoDetect: boolean;
}

export interface Resolution {
  preset: Preset;
  reason: ResolveReason;
}

export const FALLBACK_PRESET_ID = 'layout:action';

export function genrePresetId(archetype: ArchetypeId): string {
  return `layout:${archetype}`;
}

export function resolvePreset(game: GameInfo | null, ctx: ResolveContext): Resolution {
  const get = (id: string | undefined) => (id ? ctx.presets.get(id) : undefined);

  if (game) {
    const assigned = get(ctx.assignments[game.key]);
    if (assigned) return { preset: assigned, reason: 'assigned' };
    if (ctx.autoDetect) {
      const tuned = get(game.tunedIds[0]);
      if (tuned) return { preset: tuned, reason: 'tuned' };
      const genre = get(genrePresetId(game.archetype));
      if (genre) return { preset: genre, reason: 'genre' };
    }
  }

  const fallback = get(ctx.defaultPresetId) ?? get(FALLBACK_PRESET_ID);
  if (!fallback) throw new Error('No default preset available');
  return { preset: fallback, reason: 'default' };
}

/** Presets worth offering for a game, best match first, without duplicates. */
export function candidatePresets(
  game: GameInfo | null,
  ctx: ResolveContext,
  userPresets: readonly Preset[],
): Preset[] {
  const ids: string[] = [];
  if (game) {
    const assigned = ctx.assignments[game.key];
    if (assigned) ids.push(assigned);
    ids.push(...game.tunedIds, genrePresetId(game.archetype));
  }
  ids.push(ctx.defaultPresetId, ...userPresets.map((p) => p.id));
  const seen = new Set<string>();
  const out: Preset[] = [];
  for (const id of ids) {
    const preset = ctx.presets.get(id);
    if (preset && !seen.has(id)) {
      seen.add(id);
      out.push(preset);
    }
  }
  return out;
}
