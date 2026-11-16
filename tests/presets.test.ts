import { describe, expect, it } from 'vitest';
import { isInputCode, RESERVED_CODES } from '../src/core/inputs';
import { fromPresetFile, sanitizePreset, toPresetFile, usesMouse } from '../src/core/preset';
import { candidatePresets, resolvePreset, type GameInfo } from '../src/core/resolve';
import { normalizeTitle } from '../src/core/titles';
import { ARCHETYPE_IDS } from '../src/data/archetypes';
import { allGames, archetypeForGenres, gameById } from '../src/data/catalog';
import { GAMES } from '../src/data/games';
import { builtinPresets, describeGame } from '../src/data/library';

describe('built-in presets', () => {
  const presets = [...builtinPresets().values()];

  it('includes every genre layout', () => {
    for (const id of ARCHETYPE_IDS) expect(builtinPresets().has(`layout:${id}`)).toBe(true);
  });

  it('survive validation unchanged', () => {
    for (const preset of presets) expect(sanitizePreset(preset)).toEqual(preset);
  });

  it('never bind a reserved key', () => {
    for (const preset of presets) {
      for (const codes of Object.values(preset.bindings)) {
        for (const code of codes ?? []) {
          expect(RESERVED_CODES.has(code), `${preset.id} binds ${code}`).toBe(false);
          expect(isInputCode(code), `${preset.id} has bad code ${code}`).toBe(true);
        }
      }
    }
  });

  it('match at least one game in the cloud catalog', () => {
    const catalogKeys = new Set(allGames().map((g) => normalizeTitle(g.title)));
    for (const spec of GAMES) {
      const matched = spec.titles.some((t) => catalogKeys.has(normalizeTitle(t)));
      expect(matched, `${spec.name} matches no catalog title`).toBe(true);
    }
  });

  it('label only targets they bind', () => {
    for (const preset of presets) {
      for (const target of Object.keys(preset.labels)) {
        expect(
          preset.bindings[target as keyof typeof preset.bindings],
          `${preset.id} labels unbound ${target}`,
        ).toBeTruthy();
      }
    }
  });
});

describe('preset files', () => {
  it('round-trip through the share format', () => {
    const preset = builtinPresets().get('game:forza-horizon')!;
    expect(fromPresetFile(JSON.parse(JSON.stringify(toPresetFile(preset))))).toEqual(preset);
  });

  it('reject junk and clean bad values', () => {
    expect(sanitizePreset(null)).toBeNull();
    expect(sanitizePreset({ name: 'No id' })).toBeNull();
    const cleaned = sanitizePreset({
      id: 'user:x',
      name: '  Mine  ',
      bindings: { a: ['Space', 'Escape', 42, 'Space'], nonsense: ['KeyA'] },
      mouse: { sensitivity: 900, target: 'sideways' },
      toggles: ['a', 'lsUp'],
    })!;
    expect(cleaned.name).toBe('Mine');
    expect(cleaned.bindings).toEqual({ a: ['Space'] });
    expect(cleaned.mouse.sensitivity).toBe(100);
    expect(cleaned.mouse.target).toBe('right');
    expect(cleaned.toggles).toEqual(['a']);
  });
});

describe('game detection and resolution', () => {
  const presets = builtinPresets();
  const ctx = { presets, assignments: {}, defaultPresetId: 'layout:action', autoDetect: true };

  it('identifies Forza Horizon 6 from its URL and picks the tuned preset', () => {
    const game = describeGame({
      kind: 'stream',
      productId: '9N431PX143P8',
      slug: 'forza-horizon-6-standard-edition',
    });
    expect(game?.title).toMatch(/Forza Horizon 6/);
    expect(resolvePreset(game, ctx)).toMatchObject({
      reason: 'tuned',
      preset: { id: 'game:forza-horizon' },
    });
  });

  it('falls back to the URL slug for games missing from the catalog', () => {
    const game = describeGame({
      kind: 'stream',
      productId: 'ZZZZZZZZZZZZ',
      slug: 'forza-horizon-6-premium-edition',
    });
    expect(game?.tunedIds).toEqual(['game:forza-horizon']);
  });

  it('uses the genre layout when no tuned preset exists', () => {
    const game: GameInfo = {
      key: 'x',
      title: 'X',
      archetype: 'fighting',
      nativeMouse: false,
      tunedIds: [],
    };
    expect(resolvePreset(game, ctx)).toMatchObject({
      reason: 'genre',
      preset: { id: 'layout:fighting' },
    });
  });

  it('prefers the preset the user picked for the game', () => {
    const game: GameInfo = {
      key: 'x',
      title: 'X',
      archetype: 'fighting',
      nativeMouse: false,
      tunedIds: [],
    };
    const result = resolvePreset(game, { ...ctx, assignments: { x: 'layout:racing' } });
    expect(result).toMatchObject({ reason: 'assigned', preset: { id: 'layout:racing' } });
  });

  it('uses the default when auto-detect is off or nothing is known', () => {
    const game: GameInfo = {
      key: 'x',
      title: 'X',
      archetype: 'fighting',
      nativeMouse: false,
      tunedIds: [],
    };
    expect(resolvePreset(game, { ...ctx, autoDetect: false }).reason).toBe('default');
    expect(resolvePreset(null, ctx).reason).toBe('default');
  });

  it('offers alternatives without duplicates', () => {
    const game = describeGame({ kind: 'stream', productId: '9N431PX143P8' })!;
    const ids = candidatePresets(game, ctx, []).map((p) => p.id);
    expect(ids[0]).toBe('game:forza-horizon');
    expect(ids).toContain('layout:racing');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps genres to layouts', () => {
    expect(archetypeForGenres(['Action & adventure', 'Shooter'])).toBe('shooter');
    expect(archetypeForGenres(['Racing & flying', 'Sports'])).toBe('racing');
    expect(archetypeForGenres([])).toBe('action');
    expect(gameById('9n431px143p8')?.title).toMatch(/Forza Horizon 6/);
  });

  it('keeps fighters on the fighting layout', () => {
    expect(archetypeForGenres(['Fighting'])).toBe('fighting');
    expect(archetypeForGenres(['Sports', 'Fighting', 'Simulation'])).toBe('fighting');
    expect(archetypeForGenres(['Family & kids', 'Fighting', 'Platformer'])).toBe('fighting');
  });

  it('treats Fighting after action or role playing as a side tag', () => {
    expect(archetypeForGenres(['Role playing', 'Action & adventure', 'Fighting'])).toBe('rpg');
    expect(archetypeForGenres(['Action & adventure', 'Fighting'])).toBe('action');
    expect(archetypeForGenres(['Action & adventure', 'Fighting', 'Platformer'])).toBe('platformer');
  });

  it('knows which layouts use the mouse', () => {
    expect(usesMouse(presets.get('layout:rpg')!)).toBe(true);
    expect(usesMouse(presets.get('layout:fighting')!)).toBe(false);
    const clicksOnly = structuredClone(presets.get('layout:fighting')!);
    clicksOnly.bindings.x = ['Mouse0'];
    expect(usesMouse(clicksOnly)).toBe(true);
  });

  it('gives Where Winds Meet a layout that looks around with the mouse', () => {
    const game = describeGame({ kind: 'stream', productId: '9N76QGDS5GJR' })!;
    expect(game.title).toBe('Where Winds Meet');
    const { preset } = resolvePreset(game, ctx);
    expect(preset.id).toBe('layout:rpg');
    expect(preset.mouse.target).toBe('right');
  });
});
