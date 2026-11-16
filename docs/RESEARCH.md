# Research

Verified findings that the build relies on. Dates are when they were checked. Update this file when something changes.

## How xCloud reads controllers (xbox.com/play web bundle, 2026-10-24)

Read from `client.*.js`, `9679.*.js` and `1715.*.chunk.js` served by `assets.play.xbox.com`.

- A pad counts as usable only if `connected` is true, `axes.length >= 4` and `buttons.length >= 16` (function `S` in the client bundle), unless a non-standard-gamepad flag is set.
- The "current" pad is the one with the highest `timestamp` (`getCurrentGamepadId`).
- The site listens for `gamepadconnected` and `gamepaddisconnected` on `globalThis`.
- With more than one connected standard pad, it opens a "no local multiplayer" dialog (`hasSeenNoLocalMultiplayerModal`).
- The pad `id` picks the button icons shown in the interface.
- The UI navigation library has its own `injectGamepad`, `startGamepadPolling` and `POLLING_MODES`. Better xCloud hooks the stream client's internal `inputChannel.sendGamepadInput`. We use neither.

## How the xCloud stream reads mouse and keyboard (game-stream and web-rtc-stream chunks, 2026-10-26)

- The stream polls the controller every **4 ms** (`pollGamepadsIntervalMs = 4`) and compares per-pad timestamps. A key press reaches the stream within about 4 ms; any delay players feel comes from the preset (ramps), not the pipeline.
- Native mouse and keyboard only turns on in **full screen**. The message "Mouse and Keyboard isn't enabled or app is not in full-screen mode" comes from that check. This is why a game with its own mouse support behaves differently windowed and in full screen.
- In full screen it calls `navigator.keyboard.lock(["Escape"])`, so Esc goes to the page instead of releasing the mouse, and requests Pointer Lock with `{ unadjustedMovement: true }`.
- The mouse sink listens on `window` for `pointermove`, `pointerdown` and `pointerup` (bubble phase) and `wheel` (passive). It sends relative movement while the pointer is locked, and absolute positions in full screen even without a lock (`shouldUseAbsoluteMouseInputSink`). It never reads `mouse*` events.
- The keyboard sink listens on `window` for `keydown` and `keyup` and forwards every key.
- An input modality tracker also watches `pointerdown` and `pointermove` on the player root to decide whether the user is on mouse or controller.
- The player puts its own container in full screen (`this._fullscreenElement`), not the whole page. Only that element and its children are drawn, so anything attached elsewhere disappears in full screen.

Consequence: in a game with its own mouse support, stopping only mouse events and bound keys is not enough. Pointer events and unbound keys reach the stream, it sends them to the game, and the game switches its input mode. See D16.

## Store categories are loose (catalog audit, 2026-10-30)

- Categories come in the store's order, main one first.
- Fighting is used for one-on-one fighters and also for action games with combat: Where Winds Meet (Role playing, Action & adventure, Fighting), NARAKA: BLADEPOINT, Chivalry 2, Sifu, DC Universe Online, Party Animals, beat-'em-ups such as Streets of Rage 4. Real fighters list it first or after Sports. See D24.
- Multi-player Online Battle Arena is also used loosely (Chivalry 2, NARAKA), but its layout drives the camera with the mouse, so nothing breaks.

## Popup startup cost (measured 2026-10-30 on the owner's Intel laptop, Direct3D 11)

- The original fire shader compiled in 1.8 s in a plain page and 2.7 to 4.1 s inside the popup, blocking the page each time. The same shader with texture noise compiled in about 0.18 s.
- KHR_parallel_shader_compile is available in Chrome there; with it the page was blocked for 0 to 1 ms.
- Headless test runs measure frames wrongly when a tab is in the background: Chrome then throttles it to 1 or 2 frames a second and CSS transitions barely move.

## Lenis (read 2026-10-30, version 1.3.27)

- MIT. About 30 KB unminified. No network, no eval.
- Its wheel handler ignores `defaultPrevented`; the `virtualScroll` option can veto an event. `allowNestedScroll` leaves elements that scroll on their own alone. `respectReducedMotion` is on by default.

## Stream URLs and game IDs

- `https://www.xbox.com/<locale>/play/launch/<slug>/<PRODUCTID>` (cloud stream)
- `https://play.xbox.com/stream/<PRODUCTID>/<slug>` (cloud stream, newer host)
- `https://www.xbox.com/<locale>/play/games/<slug>/<PRODUCTID>` (details page)
- `https://www.xbox.com/<locale>/play/consoles/launch/<CONSOLEID>` (Remote Play)

Confirmed by ModernKit's parser (module 92332 of its v4.2.0 bundle) and the route table in the xCloud bundle. Product IDs are 12 alphanumeric characters and differ per edition.

## Catalog sources

Collection IDs from the `CloudAll`, `CloudMostPopular`, `CloudPlayWithMouseAndKeyboard` (and genre) enum in the xCloud bundle:

| Collection | ID |
| --- | --- |
| All cloud games | `1bf84c2b-0643-4591-893f-d9edb703f692` |
| Most popular | `6a589fa0-d493-472b-8e20-3813699d7056` |
| Play with mouse and keyboard | `3aa7a358-f15b-476b-af7e-134a250c08a0` |
| Play with touch | `9c86f07a-f3e8-45ad-82a0-a1f759597059` |

`https://catalog.gamepass.com/sigls/v2?id=<ID>&language=en-us&market=US` returns product IDs. `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=<up to 100 IDs>&market=US&languages=en-us` returns titles, categories and attributes. On 2026-10-24: 3,657 cloud games, 66 with native mouse and keyboard. Fortnite supports it in the browser without being in the collection (support.xbox.com).

Native support is per product ID: some Call of Duty bundles have it and the launcher does not. Hence the runtime check as well (D6).

## The wire format, for reference

From the open-source `unknownskl/xbox-xcloud-player`: input goes over a WebRTC data channel named `input`. Each packet has a 14-byte header (uint16 report bitmask, uint32 sequence, float64 timestamp). A gamepad frame is 23 bytes: index, uint16 buttons (Nexus 2, Menu 4, View 8, A 16, B 32, X 64, Y 128, D-pad 256 to 2048, bumpers 4096 and 8192, stick clicks 16384 and 32768), int16 sticks (±32767, Y negated) and uint16 triggers. We never touch this layer.

## ModernKit, "Keyboard & Mouse for Xbox Cloud Gaming" (v4.2.0, read 2026-10-22 to 24)

- MV3, `minimum_chrome_version` 111. An isolated bridge plus `injected.js` in the MAIN world at `document_start` on xbox.com.
- Core (module 25992): saves the native `getGamepads`, then returns only `[{...fakeController}]` with id "Xbox 360 Controller (XInput STANDARD GAMEPAD)", mapping standard, 17 buttons and 4 axes. It bumps the timestamp on change and dispatches synthetic connect events.
- Keys set buttons and triggers to exactly 0 or 1 and sticks to exactly ±1. Holding opposite keys cancels.
- Mouse (module 267): movement is summed per animation frame, stick = clamp(pixels / sensitivity, ±1) with default sensitivity 10, and the stick snaps to center 50 ms after the mouse stops. No curve, no dead zone handling.
- Default keys: WASD left stick, mouse right stick, left click RT, right click LT, Space A, Ctrl/Backspace B, R X, scroll Y, C/G LB, Q RB, arrows D-pad, Enter Start, Tab View, Shift L3, F R3.
- Presets live in `chrome.storage.sync`, capped at 100. The "130+ presets" are a community library on their website, imported by pasting a link; submissions need playtime first. Presets link to product IDs for auto-switching. Game names come from `xkbm-static-data.modernkit.one/games/<id>.json`.
- Network: usage analytics to `api.modernkit.one/stats` with a persistent client ID (the "play" event includes game name, preset name and payment status), remote feature config, ExtensionPay licensing. No keystrokes are sent.
- The 5 MB bundle is about 3,000 webpack modules, nearly all libraries (React, Fluent UI, Redux). 38 modules are their own code.
- Chrome store: 100K users, 2.9 stars (771 ratings), 3-day trial, then a one-time payment that users report at $3 to $5.
- In-game input display (read 2026-10-26): a corner widget with modes both, joystick, pressed and none, and a corner setting. It shows a chip with the last key and the controller button it pressed, a joystick view, and a controls list that appears while a key is held and hides 1.5 s after other input. Ours (keys, sticks or both; hold to peek or tap to keep open; preset switching in the panel) was written from scratch.
- Preset library API (public, read 2026-10-25): `https://modernkit.one/xcloud-keyboard-mouse/api/presets/list.json` lists 140 community presets, each at `.../api/presets/<uuid>/index.json`. The 14 Forza presets agree on W/S/A/D/Space for driving, arrow keys for the D-pad (11 of 14), Q and E for the bumpers (8 of 14), Backspace or Ctrl for B (10 of 14) and Enter for Start (11 of 14). None can ease keys in. We used the consensus as a reference only; no preset files were copied.

## Better xCloud (redphx, MIT userscript)

- "Virtual controller" patches `getGamepads` with a stub pad but sends input through xCloud's internal channel. F8 toggles, Esc releases. The mouse goes to a chosen stick through sensitivity, a dead zone counterweight and a clamp, with a 50 ms stop timer.
- Needs Tampermonkey, and often Developer Mode.
- Its own disclaimer warns that mouse emulation online can count as cheating in games with mouse detection.
- Install base: GitHub, the Android app and a webOS build.

## Other tools

- **EmuX** (Chrome, free, 4K users, 4.2 stars): profiles and FPS, Racing and Platformer presets. Users noted no scroll wheel bindings and missing stick-click bindings.
- **xCloud Keyboard & Mouse** (ScarFred, about 1K users): in-game overlay; calls itself open source but links no code.
- **reWASD**: paid Windows app with a system-wide virtual pad.

## What users complain about, and what we did

| Complaint | Where | Our answer |
| --- | --- | --- |
| Paying for basic keybinds, trial bugs, emails rejected, price changes | ModernKit reviews | Free, no account, no trial |
| "Only able to move full speed", cannot sneak | ModernKit review, June 2026 | Ease-in ramps and precision hold |
| Cannot lockpick in Kingdom Come Deliverance 2 | ModernKit review, March 2026 | Precision hold and slow ramps for fine stick control |
| Clashes with Xbox's own mouse mode in Fortnite | ModernKit reviews, 2024 | Stand by in native games, runtime detection |
| "Not very suitable for FPS", laggy, not smooth | ModernKit reviews | Per-millisecond speed, curve, dead zone push, smoothing, raw input |
| Virtual controller stopped working after an xCloud update | Better xCloud #909 | Public API only (D1) |
| Settings or presets disappeared | Better xCloud #909 comments | Validated storage, sync fallback, backups |
| No scroll wheel or stick-click bindings | EmuX users | Wheel in four directions and every button, including Xbox |
| Remap the Xbox guide button | Better xCloud #581 | `guide` is bindable (Home by default) |
| Mouse does not work on Android tablets | ModernKit review | Explained up front: Pointer Lock is not available there |
| AZERTY layouts | Better xCloud discussion #481 | Physical key codes and layout-aware labels |

## Design research

Sources on AI-generated design tells: "The Tells" (Han Kim), Nutlope/hallmark anti-patterns, Ad-Astra AHD slop taxonomy, the OIM3690 guide, booplex.com, developersdigest.tech. Applied in `DESIGN.md`.

## Store and search research

Chrome Web Store guidance (developer.chrome.com/docs/webstore/best-listing and /discovery) plus extensionfast.com, cwspy.com, extwatch.com and dev.to write-ups. Applied in `STORE_LISTING.md`.
