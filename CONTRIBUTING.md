# Contributing

Thanks for helping. The most useful contributions are presets for games, and reports of games that do not play well.

## Set up

```bash
npm install
npm run dev
```

Load `dist/` at `chrome://extensions` with Developer mode on. After a change, press the reload button on the extension card and refresh the xCloud tab.

## Before you open a pull request

```bash
npm run check   # types, lint, unit tests, build
npm run e2e     # the extension in Chromium, end to end
```

GitHub runs the same checks on every pull request.

## License of your contribution

Ghostrol is under the GNU General Public License, version 3 (see [LICENSE](LICENSE)). By opening a pull request you agree that your contribution is shared under the same license. There is no separate agreement to sign.

## Adding or fixing a game preset

Follow [docs/PRESETS.md](docs/PRESETS.md). In short: confirm the game's controller layout from a source, add a `GameSpec` in `src/data/games.ts`, use the game's own words for labels, and list the source. The tests check that your titles match real catalog games.

Tested a preset in a real game? Say so in the pull request, with what you checked.

## Code

- `src/core` is pure TypeScript with no browser APIs, and every behavior has a test.
- The page script stays small and framework free.
- Match the surrounding style. Prettier formats on `npm run format`.
- Interface text follows [docs/DESIGN.md](docs/DESIGN.md): plain, specific, sentence case, no em dashes.

## Reporting a problem

Use Report a problem in the Ghostrol popup: it opens a GitHub issue with the version, browser, game and preset already filled in. Add what you pressed, what happened and what you expected.

Security problems go through [SECURITY.md](SECURITY.md), not public issues.

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
