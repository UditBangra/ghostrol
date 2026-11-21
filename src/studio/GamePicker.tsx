import { useEffect, useMemo, useState } from 'preact/hooks';
import { REMOTE_PLAY_KEY, remotePlayGame } from '../core/resolve';
import { normalizeTitle } from '../core/titles';
import { archetypeName } from '../data/archetypes';
import { allGames, archetypeForGenres, gameByTitle, type CatalogGame } from '../data/catalog';
import { loadRecent, type RecentGame } from '../shared/storage';

/** A game chosen in the picker. key is the normalized title used for per-game choices. */
export interface PickedGame {
  key: string;
  title: string;
  game?: CatalogGame | undefined;
}

const SHOWN = 6;

/** The title to show for a stored game key. */
export function gameTitle(key: string, recent: readonly RecentGame[] = []): string {
  if (key === REMOTE_PLAY_KEY) return remotePlayGame().title;
  return gameByTitle(key)?.title ?? recent.find((r) => r.key === key)?.title ?? key;
}

function search(query: string): PickedGame[] {
  const q = normalizeTitle(query);
  const seen = new Map<string, PickedGame>();
  const starts: PickedGame[] = [];
  const contains: PickedGame[] = [];
  // The catalog is sorted by popularity, so the first matches are the likely ones.
  for (const game of allGames()) {
    const key = normalizeTitle(game.title);
    if (!key.includes(q)) continue;
    const known = seen.get(key);
    // Editions of one game share a key. Show the plainest title, such as the standard one.
    if (known) {
      if (game.title.length < known.title.length) known.title = game.title;
      continue;
    }
    const entry = { key, title: game.title, game };
    seen.set(key, entry);
    (key.startsWith(q) ? starts : contains).push(entry);
  }
  // Remote Play is not a game, but a preset can be picked for it like one.
  const remote = remotePlayGame();
  if (q && normalizeTitle(remote.title).startsWith(q)) {
    starts.unshift({ key: remote.key, title: remote.title });
  }
  return [...starts, ...contains].slice(0, SHOWN);
}

/** Search box for games, with recently played games before anything is typed. */
export function GamePicker(props: {
  label: string;
  picked: readonly string[];
  onPick: (game: PickedGame) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentGame[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => void loadRecent().then(setRecent), []);

  const results = useMemo<PickedGame[]>(() => {
    if (!query.trim()) {
      return recent
        .slice(0, SHOWN)
        .map((r) => ({ key: r.key, title: r.title, game: gameByTitle(r.title) }));
    }
    const found = search(query);
    const typed = normalizeTitle(query);
    // A game that is not in the catalog yet can still be named by hand.
    if (typed && !found.some((g) => g.key === typed)) {
      found.push({ key: typed, title: query.trim() });
    }
    return found;
  }, [query, recent]);

  const pick = (game: PickedGame | undefined) => {
    if (!game || props.picked.includes(game.key)) return;
    props.onPick(game);
    setQuery('');
    setActive(0);
  };

  const listId = `picker-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  const showList = open && results.length > 0;

  return (
    <div class="picker">
      <input
        class="field"
        type="search"
        aria-label={props.label}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={props.placeholder ?? 'Search games'}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onInput={(e) => {
          setQuery((e.target as HTMLInputElement).value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((i) => Math.min(results.length - 1, i + 1));
          else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
          else if (e.key === 'Enter') pick(results[active]);
          else return;
          e.preventDefault();
        }}
      />
      {showList && (
        <ul class="picker-results" id={listId} role="listbox" aria-label={props.label}>
          {!query.trim() && <li class="picker-note faint">Played recently</li>}
          {results.map((game, i) => {
            const added = props.picked.includes(game.key);
            const detail = !game.game
              ? 'Not in the catalog yet. Uses this name.'
              : `${archetypeName(archetypeForGenres(game.game.genres))} layout`;
            return (
              <li key={game.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  class={i === active ? 'picker-item active' : 'picker-item'}
                  disabled={added}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(game)}
                >
                  <span class="picker-title">{game.title}</span>
                  <span class="faint small">{added ? 'Added' : detail}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
