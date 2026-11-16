# Implementation plan

This is the build plan for a free, open-source Chrome extension that lets people play any Xbox Cloud Gaming title with a keyboard and mouse. It is called **Ghostrol** (see `NAMING.md`).

## Goals

1. Works with every game on Xbox Cloud Gaming, not one title.
2. Free, no accounts, no trial, no telemetry, no network requests.
3. Detects the game you launch and loads the right preset automatically.
4. Ships with a preset for every cloud game in the catalog: hand-tuned layouts for the most played games, genre layouts for everything else.
5. Feels better to play than ModernKit and Better xCloud: analog keys, smoother mouse aim, steering-wheel mouse mode, no stuck keys, no fights with native mouse support.
6. Simpler to use than Better xCloud, with nothing given up in capability.
7. A distinctive interface built around keycaps and controllers, written in plain language.
8. Clean, tested, documented code that a second developer can pick up.

## What we learned that shapes the plan

Full notes are in `RESEARCH.md`. The short version:

- **The core trick is proven.** ModernKit replaces `navigator.getGamepads()` in the page and returns a fake standard controller. It has worked for years and works today in Forza Horizon 6. We use the same public-API layer. We do not patch xCloud's private code the way Better xCloud does, because those patches break on site updates (Better xCloud issue #909, March 2026).
- **xCloud's player rules** (read from its current web bundle): a pad only counts if `connected` is true with at least 4 axes and 16 buttons; the most recent pad is chosen by `timestamp`; more than one connected pad opens a "local multiplayer not supported" dialog. So we expose exactly one pad and bump `timestamp` on every change.
- **Game detection is reliable.** Every stream URL carries the store product ID and a name slug (`/play/launch/<slug>/<ID>` and `play.xbox.com/stream/<ID>/<slug>`).
- **Microsoft's public catalog** lists every cloud game with genres, and a separate list of games with native mouse and keyboard support. We use it to give every game a sensible preset and to avoid clashing with native support.
- **User complaints we will fix**: paywall and trial bugs, full-speed-only movement, no fine stick control (lockpicking, sneaking), mouse aim that feels floaty or laggy, clashes with native mouse support in Fortnite, settings that vanish, missing scroll wheel and stick-click bindings, no Guide button binding, setup friction (Tampermonkey).

## Architecture in one paragraph

A tiny script runs inside the xCloud page before the site loads and swaps in a virtual controller. A second content script (the bridge) reads settings from extension storage, detects the game from the URL, and sends the right preset to the page. The input engine turns keys and mouse movement into controller state and is computed on demand whenever the site polls the controller, so it adds no timers and no lag. The popup handles quick changes; the Studio page handles presets, bindings, mouse tuning and a live test area. Details: `ARCHITECTURE.md`.

## Milestones

### M1. Foundation
- Project tooling: TypeScript (strict), esbuild build script, Vitest, Prettier.
- Core model: controller targets, input codes, preset schema with validation and versioned migration.
- Input engine: key ramps, precision modifier, toggles, wheel pulses, diagonal normalization.
- Mouse engine: frame-rate independent camera mode (velocity window, curve, anti-deadzone, smoothing) and steering-wheel mode (position with optional return to center).
- Unit tests for all of the above.

### M2. Running in xCloud
- Page script: gamepad shim, keyboard and mouse capture, pointer lock, focus and visibility safety, real-controller auto handoff.
- Bridge: storage access, game detection on URL change, preset resolution, page messaging.
- Background: commands (toggle, cycle preset), badge, install flow.
- In-page overlay in a closed shadow root: capture prompt and short status messages.

### M3. Presets and catalog
- Catalog generator script (`scripts/fetch-catalog.mjs`) that pulls cloud games, genres and native mouse support from Microsoft's public endpoints.
- Archetype layouts: shooter, action, racing, sports, fighting, platformer, RPG, strategy, flight, twin-stick, menu.
- Hand-tuned presets for the most played cloud games, with an action name for every key ("Handbrake", not just "A").
- Resolution order: your pick for this game, then a tuned preset, then a genre layout, then your default.

### M4. Interface
- Design system: tokens, keycap component, controller diagram, slider, switch, select.
- Popup: current game, preset, on/off, sensitivity, link to the Studio.
- Studio: preset library, binding editor with key capture, mouse tuning with a live curve, test area, game assignments, import and export, settings, welcome flow.

### M5. Polish and release
- In-page input display (optional HUD) and live sensitivity keys.
- Store listing copy, screenshots, promo tiles, landing pages generated from preset data.
- End-to-end test that loads the built extension in Chromium and checks the virtual pad.
- Packaging script for the Chrome Web Store.

## How we keep quality high

- Every behavior that can be a pure function is one, and has a test.
- The page script stays small, has no framework, and allocates nothing in hot paths it can avoid.
- Storage is versioned with migrations, writes are validated, and there is always an export.
- No guessing: anything unclear about xCloud gets checked against its shipped code or real behavior first, and the finding goes into `RESEARCH.md`.
- Progress and open questions live in `PROGRESS.md`. Decisions live in `DECISIONS.md`.
