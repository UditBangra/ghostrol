# Working on this project

A Manifest V3 Chrome extension that lets people play Xbox Cloud Gaming with a keyboard and mouse by presenting a virtual Xbox controller. The product is called **Ghostrol** (see `docs/NAMING.md`).

## Read first

- `docs/PROGRESS.md`: what is done, what is next, known issues. Update it when you finish work.
- `docs/ARCHITECTURE.md`: how the parts fit together.
- `docs/DECISIONS.md`: why things are the way they are. Add an entry for any real decision.
- `docs/RESEARCH.md`: verified facts about xCloud, competitors and users. Check here before assuming anything about xCloud.
- `docs/DESIGN.md`: the visual language and writing rules. Follow it for any interface or copy change.
- `docs/PRESETS.md`: preset format and how to add a game.

## Commands

The folder name contains `&`, which breaks npm's Windows `.cmd` shims, so the scripts call tools through `node` directly. Use the npm scripts, not `npx`.

```bash
npm run build        # dist/
npm run dev          # watch
npm test             # vitest unit tests
npm run typecheck    # tsc --noEmit (TypeScript 7)
npm run e2e          # build, then load dist/ in Playwright Chromium and run checks
npm run shots        # same, plus screenshots in .cache/shots for design review
npm run catalog      # regenerate src/data/catalog.json
npm run check        # typecheck + test + build
```

Run `npm run check` and `npm run e2e` before calling work done.

## Layout

```
src/core/      pure logic: targets, inputs, presets, engine, mouse, detection, resolution (tested)
src/data/      genre layouts, tuned game presets, generated catalog
src/page/      MAIN world script on xbox.com: gamepad shim, capture, overlay
src/bridge/    isolated content script: URL detection, storage, messaging
src/background/ service worker: preset resolution, shortcuts, install flow
src/popup/     toolbar popup
src/studio/    options page: presets, games, settings, welcome
src/ui/        shared components, tokens.css, hooks
scripts/       build, manifest, catalog generator
tests/         unit tests; tests/e2e/run.mjs for the browser check
```

## Rules

- Keep `src/core` free of browser APIs so it stays testable. Add tests for any behavior change there.
- The page script must stay small and framework free. Never expose more than one controller to the site.
- Everything entering storage goes through `sanitizePreset` or `sanitizeSettings`.
- No network requests from the extension, ever. No analytics.
- Interface text: plain, specific, sentence case, no em dashes, no hype. See `docs/DESIGN.md`.
- Only add a tuned game preset when its controller layout is confirmed by a source. Record the source in `docs/PRESETS.md`.

## Gotchas

- `web_accessible_resources.matches` only accepts whole-origin patterns. A path pattern makes Chrome refuse to load the extension.
- Playwright's bundled Chromium still supports `--load-extension`; branded Chrome does not.
- `<kbd>` defaults to monospace. `tokens.css` resets it; keep it that way.
