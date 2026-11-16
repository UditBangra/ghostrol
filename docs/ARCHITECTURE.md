# Architecture

## The parts

```
 xbox.com/play tab
 ┌──────────────────────────────────────────────────────────────────────┐
 │  page script (MAIN world)              bridge (isolated world)       │
 │  ┌──────────────────────┐  postMessage  ┌────────────────────────┐   │
 │  │ GamepadShim          │◄─────config───┤ URL watch, game detect │   │
 │  │ InputCapture         │───status─────►│ session state          │   │
 │  │ InputEngine          │               │ storage reads          │   │
 │  │ Overlay (shadow DOM) │               └───────────┬────────────┘   │
 │  └──────────┬───────────┘                           │                │
 │             │ navigator.getGamepads()               │ runtime msg    │
 │  xCloud web player                                  │                │
 └─────────────────────────────────────────────────────┼────────────────┘
                                                       ▼
                                  background service worker
                                  catalog + presets + resolution, shortcuts
                                                       ▲
                    popup, Studio ── chrome.storage ───┘ (single source of truth)
```

### Page script (`src/page`, MAIN world, `document_start`)

Runs inside the site's own JavaScript world before the site loads.

- **GamepadShim** replaces `navigator.getGamepads`. While a game is being played and emulation is on, it returns exactly one virtual pad: `[pad, null, null, null]`. Otherwise it passes the real result through. It bumps `timestamp` on every state change, fires `gamepadconnected` and `gamepaddisconnected`, and hands over to a real controller when one is used more recently than the keyboard or mouse.
- **InputCapture** listens on `window` in the capture phase, which runs before any of the site's listeners. Bound keys are handled and stopped; unbound keys pass through; typing in text fields is never touched. The mouse is read only while captured with Pointer Lock, using raw movement when available. Blur, tab hide and losing the lock all release every input. It also wraps `Element.prototype.requestPointerLock` to notice when the site asks for the mouse itself, which signals its own mouse and keyboard mode.
  In **exclusive mode** (the user picked Ghostrol in a game with its own mouse support) it also hides every key, pointer and wheel event from the site, because in full screen the stream would forward them to the game (D16). Pointer events are hidden whenever the mouse is captured. Esc releases the capture itself, because the stream locks Esc in full screen.
- **Shortcuts**: the page matches Chrome's shortcut text (`core/shortcuts.ts`) before anything else, so Alt+K, Alt+Period and Alt+C work in full screen. Chrome's copy of the same press is ignored (D18).
- **InputEngine** (from `src/core`) holds the state.
- **Overlay** lives in a closed shadow root and moves into the full screen element when there is one. It holds:
  - the capture prompt and short messages
  - **Hud** (`hud.ts`): key chips (key, controller button, action, gone 0.8 s after release) and the sticks view, in a chosen bottom corner
  - **ControlsPanel** (`panel.ts`): every key with its button and action, a preset switcher and mouse speed. Hold the shortcut to peek, tap to keep it open (D19). Picks and speed changes go to the bridge as `use-preset` and `mouse-speed` messages.

The page script has no framework and never talks to extension APIs. It is about 65 KB.

### Bridge (`src/bridge`, isolated world, `document_start`)

- Parses the URL (`core/detect.ts`) whenever the Navigation API reports a change (xCloud is a single-page app that uses `history.pushState`), on `popstate`, and every 3 s as a safety net (D30).
- Accepts from the page only presets it offered and real shortcut commands, since any script on xbox.com can post to it.
- Asks the background for the preset when the URL or stored state changes, then sends the page a `PageConfig`.
- Decides the mode: `emulate`, `native` (the game has its own mouse support and the user has not chosen otherwise, or the site asked for the mouse), or `off` (disabled or paused).
- Answers the popup's `get-session`. Forwards Chrome shortcut commands to the page, which decides whether it already handled them, and runs the toggle and preset cycle the page sends back.
- Saves preset picks from the in-game panel, and passes mouse speed changes to the background.
- Records recent games and session counts locally.

### Background (`src/background`)

- Holds the catalog and builds the preset map (built-in plus the user's), then runs `resolvePreset`. The catalog index is built on the first lookup, so wakes that only handle a shortcut stay fast (D30).
- Handles `Alt+K` (toggle), `Alt+Period` (next preset) and `Alt+C` (controls panel) through `chrome.commands`, and sends them to the active tab.
- Sends the page the presets to offer in the panel and the name Automatic would pick. Applies mouse speed changes from the panel, copying a built-in preset for the game first.
- Sets the toolbar badge while the virtual pad is active, and opens the welcome page on install.

### Popup and Studio (`src/popup`, `src/studio`)

Preact apps. The popup's fire compiles its shader in the background and fades in, so the popup never waits on it (D25). The Studio scrolls with Lenis (`studio/scroll.ts`, D27), and segmented choices and the sidebar slide their highlight with `useThumb` in `ui/hooks.ts`. They read and write `chrome.storage` directly and react to `storage.onChanged`, so every context stays in sync without extra messages. The popup asks the active tab's bridge for live session details.

## Input engine (`src/core/engine.ts`, `src/core/mouse.ts`)

Handlers only record events. `sample(now)` computes the controller state when the site reads it:

- **Buttons** are 0 or 1. Toggle buttons latch on press. A release is held back until the press has been sampled at least once and has lasted `MIN_PRESS_MS` (60 ms), so a quick tap between two polls still reaches the game.
- **Stick directions and triggers** have ramp levels that ease out toward on or off: most of the travel happens right after the press, reaching 95% at `rampMs`. Releasing is twice as fast. A ramp of 0 is instant (D17). Each input event first advances the state to its own timestamp, so easing starts at the key press, not at the last poll.
- **Sticks from keys** are normalized so diagonals stay on the unit circle. The precision key scales sticks and triggers.
- **Mouse, camera mode**: the sum of movement in the last 24 ms divided by 24 gives speed in px/ms, independent of monitor refresh and poll rate. Speed times sensitivity goes through `shape()` (response curve plus anti-deadzone lift), then a time-based low-pass filter, so the stick eases back to center when the mouse stops.
- **Mouse, wheel mode**: horizontal movement accumulates into a position in [-1, 1], with optional decay back to center.
- `sample` reports whether anything changed since the previous sample, including changes made between polls, so the shim knows when to move `timestamp`.

## Game detection and preset choice

1. `parseGameUrl` finds the 12-character store product ID next to a route word (`launch`, `stream`, `games`) and the slug, in either order. Remote Play URLs are recognized separately.
2. `describeGame` looks the ID up in the catalog (title, genres, popularity rank, native mouse support). Unknown IDs fall back to the slug, matched by normalized title. `archetypeForGenres` picks the genre layout; Fighting listed after Action & adventure or Role playing does not count (D24).
3. `resolvePreset` picks, in order: the user's choice for this game, a tuned preset for its title, the genre layout, then the default.

Titles are normalized (`core/titles.ts`) so every edition of a game shares one key for per-game choices and tuned presets.

## Storage

| Area | Key | Contents |
| --- | --- | --- |
| sync | `settings` | `Settings` |
| sync | `assignments` | game key to preset id |
| sync | `nativePrefs` | game key to `native` or `emulate` |
| sync, local fallback | `preset:<id>` | one user preset per key, under the 8 KB item limit |
| local | `recent`, `stats` | recent games, session count, review prompt state |

All reads go through `sanitize*`, so stored data from any version or an imported file cannot break the extension. Backups export and import everything in one file.

## Catalog

`npm run catalog` pulls three collections that xbox.com itself uses (all cloud games in popularity order, plus native mouse and keyboard games) from `catalog.gamepass.com`, resolves titles and genres through `displaycatalog.mp.microsoft.com`, and writes `src/data/catalog.json`. This runs at build time only. The extension never makes network requests.

## Build

`scripts/build.mjs` bundles with esbuild: `page`, `bridge` and `background` as IIFE scripts; `popup` and `studio` as modules with their CSS. It copies the Archivo, UnifrakturMaguntia and Pirata One fonts with their licenses and the icons from `assets/icons` (`npm run icons` makes those from `assets/skull-art.png`, and draws `assets/mark.svg`, the fallback skull for the overlay), writes the manifest from `scripts/manifest.mjs`, and can zip `dist/` for the store.

## Testing

- `tests/*.test.ts` (Vitest) cover the engine, mouse model, URL detection, titles, preset validation, resolution, and that every tuned preset matches a real catalog game.
- `tests/e2e/run.mjs` loads `dist/` in Playwright's Chromium, serves a stand-in page at real xbox.com URLs so the content scripts inject as they would in production, and checks the full chain through `navigator.getGamepads()`.
