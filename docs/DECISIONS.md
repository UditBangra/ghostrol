# Decisions

Each entry: what we decided, why, and what we gave up. Newest last.

### D1. Emulate through the public Gamepad API, not xCloud internals
We replace `navigator.getGamepads()` in the page, the same layer ModernKit has used for years. Better xCloud instead patches xCloud's minified code to reach its private input channel, which broke for weeks in March 2026 (Better xCloud issue #909). The public API is stable, and a real USB pad goes through the same path. We give up nothing measurable: the site polls the pad every frame anyway.

### D2. Expose exactly one controller
xCloud opens a "local multiplayer not supported" dialog when more than one standard pad is connected (read from its web bundle). The shim shows only the virtual pad while emulating and only real pads otherwise, switching to whichever was used most recently.

### D3. Compute controller state on demand
The engine has no timers. Input handlers record events; `sample(now)` advances ramps and smoothing by elapsed time when the site polls. This keeps CPU near zero, adds no latency, and makes the logic a pure, testable function of input and time.

### D4. Measure mouse speed per millisecond
ModernKit divides each animation frame's movement by a sensitivity, so a 144 Hz screen feels different from a 60 Hz one. We average movement over a 24 ms window, which gives the same stick for the same hand speed on any setup, then apply a curve, an anti-deadzone lift and time-based smoothing.

### D5. Ease keys in, with a precision hold
Users complained they could only move at full speed, could not sneak, and could not lockpick in Kingdom Come. Keys now drive ramped levels (instant by default, eased for racing and flight) and a precision key scales sticks and triggers.

### D6. Stand by in games with native mouse support
ModernKit users reported their extension fighting Xbox's own mouse mode in Fortnite. We mark native games from Microsoft's own "Play with mouse and keyboard" collection and also detect at runtime when the site requests Pointer Lock itself. In those cases we pass through and say so, and the user can switch to us per game.

### D7. Presets for every game: genre layouts plus tuned layouts
Hand-tuning thousands of games is not possible, and guessing a layout is worse than a good generic one. Every catalog game maps to one of 11 genre layouts through its store categories. Popular games get tuned presets, but only when a source confirms the controller layout. Unconfirmed games (Marvel Rivals, Dead by Daylight, The Witcher 3) stay on genre layouts until verified.

### D8. No network requests at runtime
The catalog is generated at build time from Microsoft's public endpoints and shipped with the extension. No analytics, no remote config. This is both a privacy promise and a selling point, since ModernKit sends usage events with game names and payment status.

### D9. Sync storage with a local fallback, plus backups
Presets follow the user through Chrome sync. Each preset is its own key so no item passes the 8 KB limit, and a full sync area falls back to local storage instead of failing. Users reported settings disappearing in other tools, so there is a one-click backup and restore.

### D10. Key codes, not key characters
Bindings use `KeyboardEvent.code` (physical position), so presets work on AZERTY and QWERTZ boards. The interface shows the user's own letters through `navigator.keyboard.getLayoutMap()`.

### D11. Preact and esbuild, no heavier stack
The popup and Studio need components; Preact gives that in a few kilobytes. esbuild builds everything in under a second. TypeScript runs in strict mode.

### D12. A visual language from keyboards
The interface is built from keycaps: graphite surfaces, a skirt drawn with inset shadow, bone legends, and one honey accent where a keyboard puts its single accent key. One type family (Archivo) at two widths. This was checked against common AI-generated design tells. See `DESIGN.md`.

### D13. Show the virtual controller only while playing
On catalog pages a phantom controller would switch the site's menus into controller mode. The shim stays hidden until the URL is a stream or Remote Play session.

### D15. Every press lasts long enough to be seen
The site reads the controller about once per frame. A quick key tap can start and end between two reads and vanish, which showed up as "the back button does not work" in the first real test. A release is now held back until the press has been read at least once and has lasted 60 ms. Holding keys is unaffected; only taps shorter than 60 ms are stretched.

### D14. MIT license (replaced by D28)
MIT was the working assumption until the owner chose GPL-3.0 on 2026-11-16. See D28.

### D16. Exclusive mode when the user picks Ghostrol in a game with its own mouse support
In full screen xCloud streams every key and pointer event to such games (see RESEARCH.md), so the game kept switching to mouse and keyboard while the virtual controller was active, as reported in Blue Prince. When the user has chosen Ghostrol for one of these games, the page hides all key, pointer and wheel events from the site, claims the site's own Pointer Lock requests, and handles Esc itself because the stream locks it. Browser shortcuts still work because nothing is cancelled, only hidden. Controller-only games keep the old behavior: unbound keys pass through.

### D17. Ramps ease out, and racing throttle is instant
A linear 100 ms trigger ramp gave about 16% throttle in the first frame, which felt like input delay in Forza Horizon 6. Ramps now follow an ease-out curve that covers most of the distance right after the press and reaches 95% at the ramp time. Racing throttle and brake are instant; only steering eases (150 ms), so full lock does not spin the car. The gamepad object is also reused until the state changes, since the stream asks for it every 4 ms.

### D18. Shortcuts are caught in the page too, and the page decides on duplicates
In full screen the stream can take keys before Chrome sees them. The page reads Chrome's own shortcut text (`core/shortcuts.ts`) and handles those keys itself. Chrome may still deliver the same press as a command, so the bridge forwards Chrome commands to the page, which ignores any it already handled in the last 1.5 s. A time window in the bridge alone was flaky because the service worker can be slow to wake.

### D19. The controls panel: hold to peek, tap to keep open
Holding the shortcut shows the panel while the key is down, with the game running and the mouse still captured, like a scoreboard. A tap keeps it open and frees the mouse so the preset switcher and mouse speed can be clicked. Hold time uses event timestamps, because drawing the panel can delay the key up. The overlay moves into whatever element is in full screen, since the stream only draws its own container there.

### D20. Nothing blurred over the game
Soft shadows on fading elements over a playing video cost hundreds of milliseconds per frame without fast graphics (measured in headless Chromium). The overlay uses hard keycap skirts only.

### D21. Fire around the popup, at the owner's request
The owner asked for realistic animated flames around the popup. This breaks the "no glow" and "motion only answers the user" rules in DESIGN.md on purpose. A small WebGL shader draws it at reduced resolution, blended additively so it never hides text. It pauses when hidden, shows a still frame for reduced motion, and can be turned off in Settings. It burns with the controller: full while playing, low when idle, embers when off. The same shader sits under the welcome keyboard.

### D22. Final name: Ghostrol
Chosen by the owner on 2026-10-26. Old `fauxpad.preset` and `fauxpad.backup` files still import. See NAMING.md.


### D23. A ghost theme to match the name
On 2026-10-26 the owner asked for the look to live up to the name: a dark, supernatural wordmark in the spirit of Death Note's lettering (without copying it), a skull and crossbones logo in an old 80s and 90s illustration style, and more ghost and horror mood throughout without hurting use.

- **Wordmark:** UnifrakturMaguntia, an open-licensed (OFL) blackletter, bundled with the extension since the extension makes no network requests. Picked from 14 dark display faces rendered side by side; it has the sharpest gothic drama and stays readable as one word. Used only for the name, because blackletter slows reading in longer text. A pale copy rising off the word every 7 seconds was tried and removed at the owner's request on 2026-10-27; the wordmark is still.
- **Logo:** first drawn in code, then replaced on 2026-10-27 by artwork the owner generated with an AI image model (`assets/skull-art.png`). It has the engraved, archival look the drawn one lacked. Raw, it turned to speckle at 16 and 32 px with the eyes lost, so `scripts/make-icons.mjs` prepares the small sizes separately: more contrast, an ink outline, and the eyes painted back in. Later that day the owner generated a second version with a thick black outline, a square canvas and brighter eyes (prompts in `STORE_LISTING.md`). It replaced the first: clearly better at 48 px and up. Its outline is under a pixel wide at 32 px, so the small-size treatment stays. The drawn skull survives as `assets/mark.svg`, the overlay's fallback when a page blocks the icon image. AI-generated art may not be protected by copyright, so others could reuse it; the owner should keep the generator's terms on file.
- **The G:** UnifrakturMaguntia's fraktur G read like a C. On 2026-10-27 the owner picked Pirata One's G from six options; a font face limited to U+0047 swaps in just that letter.
- **Materials:** a warm ink-black case with print grain was tried and reverted at the owner's request on 2026-10-27. The graphite palette stays.
- **Ghost fire:** the popup fire can burn in pale, cold spectral colors. Ember stays the default.
- **In game:** the overlay shows the skull, built node by node from the SVG file, because sites can forbid `innerHTML` through Trusted Types. It adds about 4 KB to the page script.

Given up: some of the calm, neutral look D12 aimed for. The owner wants a product with character, and the theme is kept to the brand and the edges.

### D24. "Fighting" after action or role playing is a side tag
The owner found the mouse dead in Where Winds Meet, with no prompt to capture it. Its store categories are Role playing, Action & adventure, Fighting, and the genre rules checked Fighting first, so it got the fighting layout, which has no mouse. An audit of the catalog found the same for NARAKA: BLADEPOINT, Chivalry 2, Sifu, DC Universe Online, Party Animals and Mistfall Hunter. The store uses Fighting for combat in action games as well as for one-on-one fighters, and lists categories main one first. Real fighters list Fighting first (Mortal Kombat, Guilty Gear) or after Sports (UFC 5, WWE 2K26). So Fighting now only picks the fighting layout when neither Action & adventure nor Role playing comes before it. 2D brawlers tagged that way (Streets of Rage 4) move to the action layout, which plays them fine with E and F to attack.

As a safety net for any game that still lands on a keys-only preset, clicking the game says so once ("Fighting layout plays with keys only, so the mouse stays free") and points to the controls panel, and the popup no longer says "Click the game to use your mouse" for such presets. Only the sports, fighting and platformer layouts and NBA 2K are keys-only.

### D25. The popup fire never blocks the popup
Measured on the owner's Intel laptop with Direct3D 11, compiling the fire shader froze the popup for 2.7 to 4.1 s on every open, which was the lag the owner noticed. Two changes: the value noise reads a 256 by 256 texture of random bytes instead of hashing (the same smooth curve, through the linear filter), which cut the compile to about 0.2 s; and the shader compiles in the background through KHR_parallel_shader_compile, with nothing on the page asking the GPU about it until it reports done. The popup now shows content in under 0.3 s with no long tasks, and the fire fades in once its first frame is drawn. Side by side renders show the same flames.

### D26. Built-in presets show their controls locked
Sliders on built-in presets looked adjustable but were read-only, so a drag snapped back. They are now visibly locked (grey track, no grab cursor, disabled for assistive tech), and the Mouse and Keys as sticks panels say "Built-in presets stay as they are" with a Make a copy to edit button. Sliders on the user's own presets were never broken; the end-to-end test now drags one and checks the saved value.

### D27. Choices glide, and the Studio scrolls smoothly with Lenis
At the owner's request, the chosen option in every segmented control and the current section in the sidebar are one highlight that slides to the new place (340 ms, ease out), and settings that a choice brings in open to their height instead of popping in. The Studio uses Lenis (MIT, bundled) for wheel scrolling. Lenis does not check whether a wheel event was already used, so it is told to skip wheel turns that were cancelled (binding the wheel to a control) or that happen while the mouse is captured (Try it). It stands down when the system asks for less motion, and lists that scroll on their own keep their own scrolling. A new section now starts at the top. The popup and the game overlay do not use Lenis.

### D28. GPL-3.0, no contributor agreement
On 2026-11-16 the owner chose the GNU General Public License, version 3 (GPL-3.0-only), with the copyright held by Udit Bangra. The owner wants Ghostrol open for anyone to read, change and improve, but not repackaged as a closed paid extension. A license that forbids selling (PolyForm Noncommercial) would stop it from being open source, which is part of the pitch against ModernKit. Under the GPL a copy must stay GPL with its full source, and anyone who gets it may share it for free, so closed or paid clones break the license and can be taken down. The owner does not plan to move Ghostrol into a company, so there is no CLA: contributions come in under the same GPL. Given up: changing the license later, or selling commercial licenses, would need every contributor's agreement. The full license text ships in the zip as LICENSE.txt. Third-party notices for Preact and Lenis were left out at the owner's request (see PROGRESS.md).

### D29. Personal accounts, no trademark for now
The owner will publish from a personal Google account and a personal GitHub account, as a non-trader, and has bought ghostrol.com (Hostinger). No trademark filing and no company for now; the AI-generated logo stays as it is. Given up: moving the store listing to a separate account later is harder than handing over an account used only for Ghostrol.

### D30. Faster background start and checked page messages
The background worker restarts after every idle period. It used to build the whole game catalog index on each start (about 17 ms measured in Node); now the catalog ships as a JSON.parse string and the index is built on the first game lookup, so starts that only handle a shortcut or the badge take about 5 ms. The bridge now accepts a preset pick from the page only if it is one of the offered choices (or Automatic), and only real shortcut commands, since any script on xbox.com can post to it. URL changes come from the Navigation API (66 ms in the browser checks) with a 3 s safety check instead of a 500 ms poll.

### D31. Lint and CI
oxlint (pinned, no configuration) runs in `npm run check` with warnings as errors. It needs no TypeScript plugin, so it keeps working with TypeScript 7. GitHub Actions runs formatting, types, lint, unit tests, build and the browser checks on every push and pull request, and Dependabot proposes dependency updates.

