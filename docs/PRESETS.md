# Presets

## Format

A preset (`src/core/preset.ts`) has:

- `bindings`: target to a list of inputs, up to 8 per target. One input may drive several targets, which is how chords work (Warframe's 1 presses LB and A).
- `labels`: what each target does in this game, shown next to the key.
- `toggles`: buttons that latch on press.
- `mouse`: `target` (right, left or none), `mode` (camera or wheel), `sensitivity` 1 to 100, `yRatio`, `invertY`, `curve`, `antiDeadzone`, `smoothing`, `wheelReturn`.
- `analog`: `stickRampMs`, `triggerRampMs`, `precision`. Ramps ease out: most of the travel comes right after the press, and the ramp time is when they reach 95%. Keep throttle and fire buttons at 0 (instant); ease only steering and movement that needs it.

Targets are the 17 standard buttons (`a b x y lb rb lt rt view menu ls rs dpadUp dpadDown dpadLeft dpadRight guide`), 8 stick directions (`lsUp` and so on), and two actions: `precision` (scale sticks and triggers while held) and `recenter` (center the wheel in wheel mode).

Inputs are `KeyboardEvent.code` values, `Mouse0` to `Mouse4`, and `WheelUp`, `WheelDown`, `WheelLeft`, `WheelRight`. `Escape` is reserved because it releases the mouse.

Shared files use `{ "format": "ghostrol.preset", "version": 1, "preset": { ... } }`.

## Where presets come from

1. **Genre layouts** (`src/data/archetypes.ts`): shooter, action adventure, role playing, racing, sports, fighting, platformer, strategy and sim, flight, top-down, and puzzle and casual. Every catalog game maps to one through its store categories (`archetypeForGenres` in `src/data/catalog.ts`). Fighting only counts when Action & adventure or Role playing is not listed before it, because the store also tags action games with combat as Fighting (D24). Four presets are keys-only: the sports, fighting and platformer layouts and NBA 2K.
2. **Tuned presets** (`src/data/games.ts`): a genre layout plus game-specific keys and labels.
3. **User presets**: copies and imports, stored in sync storage.

## Tuned games and sources

Keys follow each game's own PC defaults where the game has a PC version, so PC players feel at home.

| Preset | Titles matched | Controller layout source |
| --- | --- | --- |
| Forza Horizon | Forza Horizon 6, Forza Horizon 5 | keymap.io (verified 2026-09-21), techwiser.com, magicgameworld.com; menu keys follow the 14 community Forza presets in ModernKit's library (arrows for the D-pad, Q and E for bumpers, Backspace for back) |
| Call of Duty | Black Ops 6 and 7, Modern Warfare II and III, Warzone, Vanguard | thegamer.com, volx.jp (Xbox default), keymap.io |
| Helldivers 2 | HELLDIVERS 2 | spottis.com, whatifgaming.com, keymap.io |
| Cyberpunk 2077 | Cyberpunk 2077 | outsidergaming.com, CD PROJEKT RED support, keymap.io |
| ARC Raiders | ARC Raiders | keymap.io |
| Warframe | Warframe | keymap.io |
| The Finals | THE FINALS | keymap.io |
| Rust Console Edition | Rust Console Edition | keymap.io |
| Palworld | Palworld | keymap.io |
| Black Myth: Wukong | Black Myth: Wukong | keymap.io |
| Hollow Knight: Silksong | Hollow Knight: Silksong | keymap.io |
| Stardew Valley | Stardew Valley | keymap.io |
| Skyrim | Skyrim Special Edition | Xbox 360 manual (same layout), UESP control names |
| Fallout 4 | Fallout 4 | Fextralife wiki, the official game manual |
| NBA 2K | NBA 2K27, NBA 2K26 | keymap.io (controller only; keys follow the sports layout) |

## Waiting for verification

These are popular but sources disagree on their controller layouts, so they use genre layouts for now:

- **Marvel Rivals**: sources disagree on the ultimate (LB+RB or both stick clicks) and on abilities 2 and 3.
- **Dead by Daylight**: survivor and killer use the same buttons for different things. It needs two presets once confirmed.
- **The Witcher 3**: one source swaps fast and strong attacks with sign casting.
- **Starfield, Kingdom Come: Deliverance II, Gang Beasts, Fallout 76**: not yet researched.

## Menus count too

Players spend a lot of time in menus, which games navigate with the D-pad, A, B and the bumpers. Every layout keeps those reachable: arrow keys on the D-pad, Space or Enter to select, Backspace to go back, and Q and E for the bumpers where the game uses them for tabs. Check menus as well as gameplay when adding a game.

## Adding a game

1. Find the game's default Xbox controller layout from at least one reliable source, plus its PC keyboard defaults if it has a PC version.
2. Add a `GameSpec` to `GAMES` in `src/data/games.ts`. Pick the closest `base` layout, then set only what differs. Keys you use are removed from other base targets automatically, so a key never does two things by accident.
3. Use the game's own words for labels, at most 40 characters.
4. List every store title the preset should match in `titles`. Editions match automatically.
5. Run `npm test`. A test fails if any title does not match a catalog game, any key is invalid, or any label points at an unbound control.
6. Add the game and its source to the table above.
