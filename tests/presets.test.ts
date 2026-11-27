import { describe, expect, it } from 'vitest';
import { isInputCode, RESERVED_CODES } from '../src/core/inputs';
import {
  DEFAULT_ANALOG,
  fromPresetFile,
  LIMITS,
  sanitizePreset,
  toPresetFile,
  usesMouse,
} from '../src/core/preset';
import {
  candidatePresets,
  REMOTE_PLAY_KEY,
  resolvePreset,
  type GameInfo,
} from '../src/core/resolve';
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
      if (spec.consoleOnly) continue;
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

  it('give saved presets from before combo keys the default delay, within limits', () => {
    const old = sanitizePreset({ id: 'user:old', name: 'Old', analog: { stickRampMs: 100 } })!;
    expect(old.analog.comboDelayMs).toBe(DEFAULT_ANALOG.comboDelayMs);
    const wild = sanitizePreset({ id: 'user:w', name: 'W', analog: { comboDelayMs: 5000 } })!;
    expect(wild.analog.comboDelayMs).toBe(LIMITS.comboDelayMs[1]);
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

  it('picks the UFC 5 and Genshin Impact presets, editions included', () => {
    for (const [productId, id] of [
      ['9NH8K4B707H0', 'game:ufc-5'],
      ['9NXTCLM90W7V', 'game:ufc-5'],
      ['9PB7MT0VTQCF', 'game:ufc-5'],
      ['9N7TFFRRZCC9', 'game:genshin-impact'],
    ]) {
      const game = describeGame({ kind: 'stream', productId });
      expect(resolvePreset(game, ctx)).toMatchObject({ reason: 'tuned', preset: { id } });
    }
  });

  it('gives UFC 5 the right stick and its two-button moves', () => {
    const ufc = presets.get('game:ufc-5')!;
    const on = (code: string) =>
      Object.entries(ufc.bindings)
        .filter(([, codes]) => codes?.includes(code))
        .map(([target]) => target)
        .sort();
    expect(on('ArrowUp')).toEqual(['rsUp']);
    expect(on('KeyU')).toEqual(['a', 'x']);
    expect(on('KeyO')).toEqual(['b', 'y']);
    expect(on('ControlLeft')).toEqual(['lt', 'rt']);
    expect(usesMouse(ufc)).toBe(false);
  });

  it('switches Genshin Impact characters with 1 to 5', () => {
    const genshin = presets.get('game:genshin-impact')!;
    expect(genshin.bindings.dpadUp).toContain('Digit1');
    expect(genshin.bindings.dpadRight).toContain('Digit2');
    expect(genshin.bindings.dpadLeft).toContain('Digit3');
    expect(genshin.bindings.dpadDown).toContain('Digit4');
    expect(genshin.bindings.lb).toContain('Digit5');
    expect(genshin.bindings.y).toContain('Digit5');
    expect(usesMouse(genshin)).toBe(true);
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

  describe('Remote Play', () => {
    const remote = describeGame({ kind: 'remote' })!;
    const gta = 'game:gta-6';
    const driving = 'game:gta-6:driving';

    it('stands in for a game so a pick can be remembered', () => {
      expect(remote).toMatchObject({ key: REMOTE_PLAY_KEY, title: 'Remote Play', remote: true });
    });

    it('uses your default until you pick, never a genre guess', () => {
      expect(resolvePreset(remote, { ...ctx, defaultPresetId: 'layout:racing' })).toMatchObject({
        reason: 'default',
        preset: { id: 'layout:racing' },
      });
    });

    it('remembers the preset picked for it', () => {
      const result = resolvePreset(remote, { ...ctx, assignments: { [REMOTE_PLAY_KEY]: gta } });
      expect(result).toMatchObject({ reason: 'assigned', preset: { id: gta } });
    });

    it('offers every preset once: yours, then games, then genres', () => {
      const mine = { ...presets.get('layout:shooter')!, id: 'user:mine', name: 'Mine' };
      const all = new Map(presets).set(mine.id, mine);
      const ids = candidatePresets(remote, { ...ctx, presets: all }, [mine]).map((p) => p.id);
      expect(ids.slice(0, 2)).toEqual(['layout:action', 'user:mine']);
      expect(new Set(ids)).toEqual(new Set(all.keys()));
      expect(ids.length).toBe(all.size);
      expect(ids.indexOf(gta)).toBeLessThan(ids.indexOf('layout:shooter'));
    });

    it('keeps the picked game preset next to its other variants', () => {
      for (const [picked, next] of [
        [driving, gta],
        [gta, driving],
      ]) {
        const ids = candidatePresets(
          remote,
          { ...ctx, assignments: { [REMOTE_PLAY_KEY]: picked! } },
          [],
        ).map((p) => p.id);
        expect(ids.slice(0, 2)).toEqual([picked, next]);
      }
    });
  });

  it('drives GTA 6 with W and S only in the driving preset', () => {
    const foot = presets.get('game:gta-6')!;
    const car = presets.get('game:gta-6:driving')!;
    expect(foot.bindings.lsUp).toEqual(['KeyW']);
    expect(foot.bindings.rt).toEqual(['Mouse0']);
    expect(car.bindings.rt).toEqual(['KeyW']);
    expect(car.bindings.lt).toEqual(['KeyS']);
    expect(car.bindings.lsUp).toBeUndefined();
    expect(car.bindings.lsLeft).toEqual(['KeyA']);
    expect(car.name).toBe('GTA 6 (driving)');
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
