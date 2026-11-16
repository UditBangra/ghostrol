import { useMemo, useState } from 'preact/hooks';
import { normalizeTitle } from '../core/titles';
import { archetypeName } from '../data/archetypes';
import { allGames, archetypeForGenres, CATALOG_DATE, catalogSize } from '../data/catalog';
import { tunedPresetIds } from '../data/presets';
import { setAssignment, type StoredState } from '../shared/storage';
import { presetMap } from '../ui/library';

const PAGE = 60;

export function GamesView({ state }: { state: StoredState }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const presets = useMemo(() => presetMap(state), [state]);
  const choices = useMemo(
    () => [...presets.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [presets],
  );

  const matches = useMemo(() => {
    const q = normalizeTitle(query);
    const games = allGames();
    return q ? games.filter((g) => normalizeTitle(g.title).includes(q)) : games;
  }, [query]);

  return (
    <div class="games">
      <header class="view-head">
        <h1 class="wide">Games</h1>
        <p class="dim">
          Every game on Xbox Cloud Gaming gets a preset automatically. Pick a different one for any
          game here.{' '}
          <span class="faint">
            {catalogSize().toLocaleString()} games, catalog from {CATALOG_DATE}.
          </span>
        </p>
        <input
          class="field search"
          type="search"
          placeholder="Search games"
          aria-label="Search games"
          value={query}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setLimit(PAGE);
          }}
        />
      </header>

      <ol class="game-list">
        {matches.slice(0, limit).map((g) => {
          const key = normalizeTitle(g.title);
          const tuned = tunedPresetIds(g.title)[0];
          const auto = tuned
            ? presets.get(tuned)?.name
            : `${archetypeName(archetypeForGenres(g.genres))} layout`;
          return (
            <li key={g.productId} class="game-row">
              <span class="rank faint">{g.rank}</span>
              <div class="game-name">
                <span>{g.title}</span>
                <span class="faint small">
                  {tuned ? 'Made for this game' : 'Genre layout'}
                  {g.nativeMouse && ', also has its own mouse support'}
                </span>
              </div>
              <select
                class="select"
                aria-label={`Preset for ${g.title}`}
                value={state.assignments[key] ?? ''}
                onChange={(e) => {
                  const value = (e.target as HTMLSelectElement).value;
                  void setAssignment(key, value || null);
                }}
              >
                <option value="">Automatic: {auto}</option>
                {choices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ol>
      {matches.length > limit && (
        <button class="btn quiet more" onClick={() => setLimit(limit + PAGE * 2)}>
          Show more ({(matches.length - limit).toLocaleString()} left)
        </button>
      )}
      {matches.length === 0 && (
        <p class="dim">No game by that name. New games are added when the catalog is refreshed.</p>
      )}
    </div>
  );
}
