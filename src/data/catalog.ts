// Lookup over the generated Xbox Cloud Gaming catalog (src/data/catalog.json).
// Only the background worker and the Studio import this, so content scripts stay small.

import type { ArchetypeId } from '../core/preset';
import { normalizeTitle } from '../core/titles';
import raw from './catalog.json';

interface CatalogFile {
  generatedAt: string;
  market: string;
  genres: string[];
  games: { id: string; title: string; genres: number[]; nativeMouse?: boolean }[];
}

export interface CatalogGame {
  productId: string;
  title: string;
  genres: string[];
  nativeMouse: boolean;
  /** 1 is the most played game on Xbox Cloud Gaming. */
  rank: number;
}

const file = raw as CatalogFile;

export const CATALOG_DATE = file.generatedAt;

/**
 * The lists and lookups are built on first use. The background worker restarts often and
 * most wakes (shortcuts, badge updates) never look up a game, so they skip this work.
 */
interface Index {
  games: CatalogGame[];
  byId: Map<string, CatalogGame>;
  byTitle: Map<string, CatalogGame>;
}
let index: Index | null = null;

function data(): Index {
  if (index) return index;
  const games: CatalogGame[] = file.games.map((g, i) => ({
    productId: g.id,
    title: g.title,
    genres: g.genres.map((n) => file.genres[n] ?? '').filter(Boolean),
    nativeMouse: g.nativeMouse === true,
    rank: i + 1,
  }));
  const byId = new Map(games.map((g) => [g.productId, g]));
  const byTitle = new Map<string, CatalogGame>();
  for (const g of games) {
    const key = normalizeTitle(g.title);
    if (key && !byTitle.has(key)) byTitle.set(key, g);
  }
  index = { games, byId, byTitle };
  return index;
}

export function catalogSize(): number {
  return file.games.length;
}

export function allGames(): readonly CatalogGame[] {
  return data().games;
}

export function gameById(productId: string): CatalogGame | undefined {
  return data().byId.get(productId.toUpperCase());
}

export function gameByTitle(title: string): CatalogGame | undefined {
  return data().byTitle.get(normalizeTitle(title));
}

/**
 * Picks a genre layout from store categories. Order matters: a game tagged both
 * "Shooter" and "Action & adventure" plays like a shooter.
 */
const GENRE_RULES: readonly [string, ArchetypeId][] = [
  ['Shooter', 'shooter'],
  ['Racing & flying', 'racing'],
  ['Fighting', 'fighting'],
  ['Sports', 'sports'],
  ['Multi-player Online Battle Arena', 'twinstick'],
  ['Platformer', 'platformer'],
  ['Role playing', 'rpg'],
  ['Action & adventure', 'action'],
  ['Strategy', 'strategy'],
  ['Simulation', 'action'],
  ['Puzzle & trivia', 'menu'],
  ['Card & board', 'menu'],
  ['Word', 'menu'],
  ['Casino', 'menu'],
  ['Educational', 'menu'],
  ['Music', 'menu'],
  ['Family & kids', 'platformer'],
  ['Classics', 'platformer'],
];

export function archetypeForGenres(genres: readonly string[]): ArchetypeId {
  for (const [genre, archetype] of GENRE_RULES) {
    if (!genres.includes(genre)) continue;
    if (genre === 'Fighting' && fightingIsASideTag(genres)) continue;
    return archetype;
  }
  return 'action';
}

/** Store categories that, listed ahead of Fighting, make it a side tag. */
const AHEAD_OF_FIGHTING = new Set(['Action & adventure', 'Role playing']);

/**
 * The store also tags action games with free cameras "Fighting" (Where Winds Meet,
 * NARAKA: BLADEPOINT, Sifu), where it means combat, not a one-on-one fighter. Real
 * fighters list Fighting first (Mortal Kombat, Guilty Gear) or after Sports (UFC 5).
 * Categories come in the store's own order, main one first, so when action or role
 * playing is listed ahead of Fighting, the game gets the layout of that genre, which
 * looks around with the mouse. The fighting layout has no mouse.
 */
function fightingIsASideTag(genres: readonly string[]): boolean {
  return genres.slice(0, genres.indexOf('Fighting')).some((g) => AHEAD_OF_FIGHTING.has(g));
}
