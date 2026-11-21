// Game identification: turns a page URL into what we know about the game.

import type { PageGame } from '../core/detect';
import { slugToTitle } from '../core/detect';
import { remotePlayGame, type GameInfo } from '../core/resolve';
import { normalizeTitle } from '../core/titles';
import { archetypeForGenres, gameById, gameByTitle } from './catalog';
import { tunedPresetIds } from './presets';

export { builtinPresets, isBuiltinId, tunedPresetIds } from './presets';

/** Identifies the game on a page from its product ID, falling back to the URL slug. */
export function describeGame(page: PageGame | null): GameInfo | null {
  if (!page) return null;
  if (page.kind === 'remote') return remotePlayGame();
  const entry = page.productId ? gameById(page.productId) : undefined;
  const slugTitle = page.slug ? slugToTitle(page.slug) : undefined;
  const fromSlug = !entry && slugTitle ? gameByTitle(slugTitle) : undefined;
  const known = entry ?? fromSlug;
  const title = known?.title ?? slugTitle;
  if (!title) return null;

  const info: GameInfo = {
    key: normalizeTitle(title),
    title,
    archetype: known ? archetypeForGenres(known.genres) : 'action',
    nativeMouse: entry?.nativeMouse ?? false,
    tunedIds: tunedPresetIds(title),
  };
  if (page.productId) info.productId = page.productId;
  if (known) info.rank = known.rank;
  return info;
}
