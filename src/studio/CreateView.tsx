// Making a preset in three choices: which games, what to start from, and a name.
// Everything else is changed afterwards in the editor, which opens with a short guide.

import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { MAX_NAME_LENGTH, type ArchetypeId, type Preset } from '../core/preset';
import { genrePresetId } from '../core/resolve';
import { ARCHETYPE_IDS, archetypeName } from '../data/archetypes';
import { archetypeForGenres } from '../data/catalog';
import { tunedPresetIds } from '../data/presets';
import { savePreset, setAssignment, type StoredState } from '../shared/storage';
import { Keycap } from '../ui/components';
import { useLayoutMap } from '../ui/hooks';
import { copyForEditing, presetMap } from '../ui/library';
import { GamePicker, type PickedGame } from './GamePicker';
import { navigate } from './Studio';

type Start = 'game' | 'genre' | 'blank';

/** Session key that tells the editor to show its guide for a preset made here. */
export const CREATED_KEY = 'ghostrol:created';

export function CreateView({ state }: { state: StoredState }) {
  const layout = useLayoutMap();
  const presets = useMemo(() => presetMap(state), [state]);
  const [games, setGames] = useState<PickedGame[]>([]);
  const [start, setStart] = useState<Start>('genre');
  const [genre, setGenre] = useState<ArchetypeId>('action');
  const [name, setName] = useState('');
  const [named, setNamed] = useState(false);
  const [busy, setBusy] = useState(false);

  const first = games[0];
  const firstGenre: ArchetypeId = first?.game ? archetypeForGenres(first.game.genres) : 'action';
  // What the first game plays with now: the user's pick, a tuned preset, or its genre.
  const gamePreset = first
    ? (presets.get(state.assignments[first.key] ?? '') ??
      presets.get(tunedPresetIds(first.title)[0] ?? '') ??
      presets.get(genrePresetId(firstGenre)))
    : undefined;

  // Picking the first game sets sensible choices below, until the user changes them.
  useEffect(() => {
    if (!first) {
      if (start === 'game') setStart('genre');
      if (!named) setName('');
      return;
    }
    setStart('game');
    setGenre(firstGenre);
    if (!named) setName(`${first.title} (mine)`.slice(0, MAX_NAME_LENGTH));
  }, [first?.key]);

  // Blank keeps the mouse and feel of the chosen genre and drops its keys.
  const base: Preset | undefined =
    start === 'game' ? gamePreset : presets.get(genrePresetId(genre));

  const create = async () => {
    if (!base || busy) return;
    setBusy(true);
    const fresh = copyForEditing(base);
    fresh.name = name.trim().slice(0, MAX_NAME_LENGTH) || 'My preset';
    if (start === 'blank') {
      fresh.bindings = {};
      fresh.labels = {};
      fresh.toggles = [];
      delete fresh.notes;
      delete fresh.basedOn;
    }
    await savePreset(fresh);
    for (const game of games) await setAssignment(game.key, fresh.id);
    sessionStorage.setItem(CREATED_KEY, fresh.id);
    navigate(`presets/${encodeURIComponent(fresh.id)}`);
  };

  const option = (value: Start, title: string, detail: string, extra?: ComponentChildren) => (
    <div
      class={start === value ? 'start-option chosen' : 'start-option'}
      role="radio"
      tabIndex={0}
      aria-checked={start === value}
      onClick={() => setStart(value)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setStart(value);
        }
      }}
    >
      <span class="start-title">{title}</span>
      <span class="dim small">{detail}</span>
      {extra}
    </div>
  );

  return (
    <div class="create">
      <header class="view-head">
        <h1 class="wide">Make a preset</h1>
        <p class="dim">Three quick choices. Every key can be changed afterwards.</p>
      </header>

      <ol class="create-steps">
        <li class="create-step">
          <Keycap code="Digit1" layout={layout} />
          <div class="create-body">
            <h2>Which game is it for?</h2>
            <p class="dim small">
              It loads on its own when you start these games. You can skip this and pick games
              later.
            </p>
            {games.length > 0 && (
              <ul class="game-chips">
                {games.map((g) => (
                  <li key={g.key} class="game-chip">
                    <span>{g.title}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${g.title}`}
                      onClick={() => setGames(games.filter((x) => x.key !== g.key))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <GamePicker
              label="Find a game"
              placeholder={games.length ? 'Add another game' : 'Search games, such as Forza'}
              picked={games.map((g) => g.key)}
              onPick={(g) => setGames([...games, g])}
            />
          </div>
        </li>

        <li class="create-step">
          <Keycap code="Digit2" layout={layout} />
          <div class="create-body">
            <h2>Start from</h2>
            <div class="start-options" role="radiogroup" aria-label="Start from">
              {first &&
                gamePreset &&
                option(
                  'game',
                  `${first.title} keys`,
                  `A copy of ${gamePreset.name}, what this game uses now. ${summary(gamePreset)}.`,
                )}
              {option(
                'genre',
                'A genre layout',
                `Common keys for a kind of game. ${summary(presets.get(genrePresetId(genre)))}.`,
                <select
                  class="select"
                  aria-label="Genre"
                  value={genre}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setGenre((e.target as HTMLSelectElement).value as ArchetypeId);
                    setStart('genre');
                  }}
                >
                  {ARCHETYPE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {archetypeName(id)}
                    </option>
                  ))}
                </select>,
              )}
              {option(
                'blank',
                'Blank',
                'No keys at all. You add every one. The mouse and feel come from the genre above.',
              )}
            </div>
          </div>
        </li>

        <li class="create-step">
          <Keycap code="Digit3" layout={layout} />
          <div class="create-body">
            <h2>Name it</h2>
            <input
              class="field name-field"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="My preset"
              aria-label="Preset name"
              onInput={(e) => {
                setName((e.target as HTMLInputElement).value);
                setNamed(true);
              }}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
            />
          </div>
        </li>
      </ol>

      <div class="create-actions">
        <button class="btn primary" disabled={!base || busy} onClick={() => void create()}>
          Create preset
        </button>
        <span class="dim small">
          {games.length
            ? `Loads for ${games.map((g) => g.title).join(', ')}. Next you can change any key.`
            : 'Next you can change any key, then pick games for it.'}
        </span>
      </div>
    </div>
  );
}

function summary(preset: Preset | undefined): string {
  if (!preset) return '';
  const bound = Object.values(preset.bindings).filter((codes) => codes?.length).length;
  const mouse =
    preset.mouse.target === 'none'
      ? 'mouse not used'
      : preset.mouse.mode === 'wheel'
        ? 'mouse steers'
        : 'mouse aims and looks';
  return `${bound} controls, ${mouse}`;
}
