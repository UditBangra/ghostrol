// Reads which game the user is on from the page URL.
//
// Known shapes (from the xCloud web bundle and ModernKit's parser, October 2026):
//   https://www.xbox.com/en-US/play/launch/<slug>/<PRODUCTID>     cloud stream
//   https://play.xbox.com/stream/<PRODUCTID>/<slug>               cloud stream, newer host
//   https://www.xbox.com/en-US/play/games/<slug>/<PRODUCTID>      game details page
//   https://www.xbox.com/en-US/play/consoles/launch/<CONSOLEID>   Remote Play
// The parser looks for a store product ID next to a known route word instead of fixed
// positions, so small route changes do not break it.

export type SessionKind = 'stream' | 'details' | 'remote';

export interface PageGame {
  kind: SessionKind;
  /** Store product ID, uppercase. Absent for Remote Play. */
  productId?: string;
  /** URL slug, when present. */
  slug?: string;
}

const PRODUCT_ID = /^[A-Z0-9]{12}$/i;
const HOSTS = new Set(['www.xbox.com', 'xbox.com', 'play.xbox.com']);

export function parseGameUrl(href: string): PageGame | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean).map(decodeSegment);
  const lower = parts.map((p) => p.toLowerCase());

  const consoles = lower.indexOf('consoles');
  if (consoles !== -1 && lower[consoles + 1] === 'launch') return { kind: 'remote' };

  for (const [word, kind] of [
    ['launch', 'stream'],
    ['stream', 'stream'],
    ['games', 'details'],
  ] as const) {
    const at = lower.indexOf(word);
    if (at === -1) continue;
    const a = parts[at + 1];
    const b = parts[at + 2];
    if (b && PRODUCT_ID.test(b) && a) return { kind, productId: b.toUpperCase(), slug: a };
    if (a && PRODUCT_ID.test(a)) {
      const game: PageGame = { kind, productId: a.toUpperCase() };
      if (b) game.slug = b;
      return game;
    }
  }
  return null;
}

/** True on pages where the user is playing, not browsing. */
export function isPlaying(game: PageGame | null): boolean {
  return game?.kind === 'stream' || game?.kind === 'remote';
}

/** "forza-horizon-6-standard-edition" becomes "Forza Horizon 6 Standard Edition". */
export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => {
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
