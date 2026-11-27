# Progress

Last updated 2026-11-27. Version 0.1.0 is published on the Chrome Web Store (submitted 2026-11-16, public by 2026-11-19): https://chromewebstore.google.com/detail/enbejgjcnknlmempckoelehnhkagmngj. Version 0.1.1 (correct rating link, uninstall page) is published too (2026-11-20), and the listing has the promo video https://www.youtube.com/watch?v=GDyVCLB7WDg. Store images are in `store/`, made by `npm run shots` then `node scripts/store-images.mjs`. Versions 0.1.2 (2026-11-21) and 0.1.3 (2026-11-23) followed. 0.1.4 (combo keys, D38) was never uploaded; 0.1.5 (UFC 5 and Genshin Impact presets, D39) includes it. The next release must be higher than 0.1.5.

On 2026-10-31 the owner reset the version to 0.1.0 for the first public release. The earlier internal builds below were also called 0.1.0 and 0.2.0; nothing was published under those numbers. From the first Chrome Web Store upload on, every release needs a higher version than the last.

## Status

0.2.0 adds the in-game controls panel, the key display, the preset maker, the fire around the popup, the final name, and fixes for input delay in racing games and for games with their own mouse support in full screen. It passes 54 unit tests and 35 end-to-end checks in Chromium. The ghost theme added afterwards (M5b) passes 57 unit tests and 36 checks. The owner has played 0.1.0 on real Xbox Cloud Gaming (Forza Horizon 6, Blue Prince), tested 0.2.0 on 2026-10-30 (fixes in M5c), and on 2026-10-31 tested the release build (0.1.0 zip with all fixes) with no problems found.

## Milestones

### M1. Foundation: done

- [x] Tooling: TypeScript 7 strict, esbuild, Vitest, Prettier, Playwright
- [x] Targets, input codes, preset schema with validation
- [x] Input engine: ease-out ramps, precision, toggles, wheel pulses, chords, exact easing at key press
- [x] Mouse: camera mode (per-millisecond speed, curve, dead zone push, smoothing), wheel mode
- [x] Unit tests

### M2. Running in xCloud: done, first real test passed

- [x] Gamepad shim exposing one standard pad, timestamp on change, connect events, pad reused until it changes
- [x] Capture: capture-phase keys, Pointer Lock with raw input, focus and visibility release, text fields left alone
- [x] Real controller handoff
- [x] Native mouse games: stand by from the catalog flag and from runtime Pointer Lock detection
- [x] Exclusive mode when the user picks Ghostrol in a native mouse game: no keys or pointer events reach the site (D16)
- [x] Bridge: URL detection for SPA navigation, preset resolution, session info for the popup
- [x] Background: resolution, Alt+K, Alt+Period and Alt+C, badge, welcome on install
- [x] Shortcuts handled inside the page as well, so they work in full screen (D18)

### M3. Presets and catalog: done, growing

- [x] Catalog generator: 3,658 games, genres, popularity, native mouse flags
- [x] 11 genre layouts
- [x] 15 tuned presets with action labels and sources
- [ ] More tuned presets (see "Waiting for verification" in `PRESETS.md`)

### M4. Interface: done

- [x] Design system and keycap components
- [x] Popup: game title, live status, preset choice, mouse speed, key sheet with controller buttons and live key feedback, Edit keys, native notice, recent games, review prompt
- [x] Studio: preset list, editor with key capture, labels, toggles, mouse and ease-in tuning, curve graph, test area, controller picker, Used for games
- [x] Studio: games list with per-game choice, settings, backup and restore, welcome
- [x] Screenshot review pass (fixed monospace keycaps, sizing, copy)

### M5. In game and polish (0.2.0): done

- [x] Controls panel over the game, in full screen too: hold to peek, tap to keep open, switch presets, change mouse speed
- [x] Key display: chips showing key, button and action, or the sticks and triggers, in either bottom corner
- [x] Preset maker: game, starting point, name, then a guided editor
- [x] Fire around the popup and under the welcome keyboard (WebGL, additive, can be turned off)
- [x] Micro-animations: views and sections settle in, rail and list hover, live status dot, chips pop
- [x] Overflow fixes in the Studio and an automatic overflow check from 860 to 1440 px wide
- [x] Final name: Ghostrol

### M5b. Ghost theme: done

- [x] Blackletter wordmark in the popup, the Studio rail and the welcome page (the rising ghost copy was removed on request)
- [x] New mark: the owner's engraved skull artwork, prepared for every size by `scripts/make-icons.mjs` (outline and eyes restored at 16 and 32 px)
- [x] Wordmark G from Pirata One, since the fraktur G read like a C
- [x] Ghost fire: pale spectral flames as a choice next to ember fire (Settings, Look)
- [x] The mark in the in-game messages and the controls panel

### M5c. Fixes from the owner's 0.2.0 test (2026-10-30): done

- [x] Where Winds Meet and similar action games no longer get the keys-only fighting layout (D24)
- [x] Clicking a game whose preset is keys-only explains why the mouse stays free; the popup says "This preset plays with keys only"
- [x] Key chips are gone 0.8 s after release: shown 0.6 s, then a 0.2 s fade (was 1.5 s plus a fade)
- [x] Built-in preset sliders look locked and offer Make a copy to edit (D26)
- [x] Popup opens without the 2 to 4 s freeze from the fire shader (D25)
- [x] Sliding highlights in every choice and the sidebar; settings slide open when a choice brings them in (D27)
- [x] Lenis smooth wheel scrolling in the Studio, with guards for wheel bindings and Try it (D27)

### M6. Release: 0.1.0 published, 0.1.1 ready

Owner's release decisions (2026-11-16, from the release guide answers): GPL-3.0 with no CLA (D28); personal Google and GitHub accounts, non-trader, no trademark or company for now, ghostrol.com bought on Hostinger (D29); no analytics in the extension or on the website; site on Vercel; donations through GitHub Sponsors only, no Support button in the popup; no fairness note and no accessibility pitch in the listing; no Discord; outreach only through the listing and launch posts on r/xcloud, r/XboxGamePass and r/cloudgaming, using the drafts as written.

- [x] Packaging script (`npm run package`, writes `release/ghostrol-<version>.zip`)
- [x] Store listing copy and SEO plan (`STORE_LISTING.md`)
- [x] Real-world test of the release build (owner, 2026-10-31: no problems)
- [x] License: GPL-3.0, copyright Udit Bangra, LICENSE.txt in the zip (D28)
- [x] Code review fixes: checked page messages, faster background start, navigation events (D30)
- [x] CI, oxlint, Dependabot, issue forms, pull request template (D31)
- [x] CHANGELOG, SECURITY, CODE_OF_CONDUCT, contributing notes for the GPL
- [x] Report a problem in the popup (pre-filled GitHub issue)
- [x] `git init` (nothing committed yet)
- [x] Public repository: https://github.com/UditBangra/ghostrol (links in brand.ts, README and issue config point there; private vulnerability reporting on)
- [x] Chrome Web Store developer account (personal Google account, publisher name Ghostrol, non-trader)
- [ ] Owner: two-step login on Google, GitHub and Vercel
- [x] ghostrol.com live on Vercel (project ghostrol, root site/, deploys on every push to main): home page and https://ghostrol.com/privacy; www redirects with 308; DNS A record at Hostinger points to 216.198.79.1
- [x] Store screenshots and promo tiles from the real build (`store/`), skull icons, permission reasons and the Microsoft disclaimer
- [x] Published on the Chrome Web Store (0.1.0, public 2026-11-19)
- [x] 0.1.1: rating link points to the listing, uninstall page at ghostrol.com/uninstalled (D32)
- [x] Uninstall feedback form with no account needed, saved privately in UditBangra/ghostrol-feedback (D33); owner adds the token in Vercel
- [x] GitHub Releases for each version, with the zip attached (v0.1.0, v0.1.1)
- [x] 0.1.2: Remote Play remembers a picked preset, Alt+Period and the panel work there, GTA 6 on foot and driving presets (D35)
- [x] 0.1.2 on the Chrome Web Store (players reported it on 2026-11-21)
- [x] 0.1.3: Remote Play at its new address, play.xbox.com/remoteplay/<console> (issue #7); the virtual pad also sends event-driven input, which Xbox can switch on in its new player (D36); game pages on play.xbox.com are recognized
- [x] 0.1.3 on the Chrome Web Store (2026-11-23); the reporters of issues #6 and #7 were asked to try it
- [x] 0.1.4: a key bound to a trigger or bumper plus another control presses the trigger or bumper first and the rest after a combo delay, 100 ms by default, set in the Studio under Combo keys (D38). From a Reddit report: one key on LT and Y showed LT + Y in the corner but did nothing in game
- [x] 0.1.5: tuned presets for UFC 5 (right stick on the arrow keys, modifiers under the left hand, D39) and Genshin Impact (PC keys), asked for in YouTube comments on 2026-11-27
- [ ] Owner: upload 0.1.5 (which includes 0.1.4) to the Chrome Web Store, then post the reply asking the Reddit player to test again and answer the two YouTube comments
- [ ] Owner: attach the 0.1.2, 0.1.3 and 0.1.5 zips to GitHub Releases
- [ ] Import from ModernKit (user's exported presets)
- [ ] Publish on Microsoft Edge Add-ons as well
- [ ] Fuller website (postponed by the owner on 2026-11-19): home, install, per-game pages, privacy, uninstall feedback page; designed by hand, smooth hover, some neon
- [x] Demo video: 36 s intro on YouTube (https://www.youtube.com/watch?v=GDyVCLB7WDg), on the store listing, ghostrol.com and the README
- [x] Technical SEO on ghostrol.com: robots.txt, sitemap with video, canonical tags, structured data (app, video, FAQ), share image, FAQ section, 404 page (D34)
- [ ] Owner: Google Search Console and Bing Webmaster Tools, sitemap submitted
- [x] THIRD-PARTY-NOTICES.txt for Preact and Lenis in the zip (owner agreed 2026-11-16)

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | 86 passed (0.1.5 adds: UFC 5 and Genshin Impact resolve to their presets, editions included; UFC 5 arrow keys, clinch pairs and Ctrl; Genshin 1 to 5) |
| `npm run e2e` (Chromium 156, stand-in page at real xbox.com URLs) | All passed again on 2026-11-27 for 0.1.5. 58 passed on 2026-11-25 (0.1.4 adds: Warframe 1 presses LB, then A about 120 ms later; a quick tap still reaches the site as LB + A). The instant Backspace tap check failed once right after the cold start and passed on the re-run |
| Real xCloud stream | Release build played by the owner on 2026-10-31, no problems |

New end-to-end checks in 0.2.0: full throttle at once and steering easing in, key chips in the corner, unbound keys passing through in controller-only games, Alt+K from inside the page, the panel opening on a tap, picking a preset in it, Esc closing it and holding to peek, exclusive mode hiding all keys and pointer events from the site while W still drives, the preset maker end to end, and no overflow in the Studio at four widths.

Found and fixed while testing: blurred shadows over the video stalled frames without a GPU (D20); a quick tap of Alt+C read as a hold when drawing the panel delayed the key up (D19); shortcut duplicates from Chrome were timed in the wrong place (D18).

## Real-world test checklist (owner)

1. Reload the extension at `chrome://extensions` (or load `dist/`).
2. Forza Horizon 6: W should give full throttle at once. A and D should still steer smoothly. Menus: arrows, Space, Backspace, Q and E.
3. Watch the bottom left corner: each key you press shows a chip with its controller button. Switch to Sticks or Both in Studio, Settings.
4. Hold Alt+C in a race: the keys appear and the game keeps running. Let go and they close. Tap Alt+C: the panel stays, the mouse is free, pick another preset, then Back to game.
5. Go full screen and repeat step 4. The panel and chips should show in full screen.
6. Blue Prince: use Ghostrol for it (popup button, or Alt+K), go full screen, play with keys and mouse. The game should stay on controller prompts the whole time. Esc should free the mouse.
7. Open the popup during a game: controller buttons next to each key, keys light up when pressed in the popup, fire at the edges.
8. Studio, Make a preset: pick a game, create, change a key, and check it loads when you start that game.
9. Alt+K to pause and resume, in full screen too.
10. Where Winds Meet: the prompt to click the game appears, and the mouse looks around after the click.
11. Open the popup a few times: it should appear at once, with the fire fading in a moment later.
12. Studio: drag sliders on one of your own presets; on a built-in one they are grey with a Make a copy to edit button.
13. Studio: switch Input display between Off and Keys, and click through the sidebar; the highlights should glide. Scroll a long page with the wheel.
14. Combo keys: in your own preset, add one key to LT and Y (or use Warframe's 1). In game, the combo action should happen, not a plain Y. If a game still misses it, raise Combo delay in the Studio.

Report anything odd with the game name and what you pressed.

## Known risks and unknowns

- **Overlay in full screen:** the overlay moves into xCloud's full screen container. If xCloud re-renders that container in a way that removes foreign children, the panel would vanish in full screen until the next change. Watch for it in step 5.
- **Shortcut conflicts:** a game may use Alt+C. Chrome lets users change the shortcut at `chrome://extensions/shortcuts`, and the page follows whatever is set there.
- **Exclusive mode and site menus:** in exclusive mode the stream's own pointer handlers see nothing, so a menu that only reacts to pointer events (not clicks) would not respond while playing. Clicks still work.
- **Native detection:** if the site asks for Pointer Lock in a game without native support, we stand by needlessly. Alt+K overrides it per game.
- **Two xbox.com sites:** since about 2026-11-21 players get either the old site or the rebuilt one on play.xbox.com (RESEARCH, the rebuilt site). Not yet tested signed in on the new site by us. The origin trial behind event-driven input expires 2026-12-08; if Chrome ships the event, the D36 path stays in use. If the site ever polls controllers inside a Web Worker by default, the virtual pad cannot reach it.
- **Playwright held at 1.64.1:** Smart App Control on the owner's laptop blocks the Chromium build newer Playwright versions use, so it is pinned and Dependabot skips it (D37). Retry now and then.
- **Combo delay:** 100 ms is a guess that leaves room for network jitter; it has not been tried in a real game yet. A game that wants the modifier held longer needs the slider raised, and a combo where the order should be different (a face button before a trigger) is not covered.
- **Overlay font:** xbox.com's content security policy may block the extension font in the overlay, which then falls back to the system font. Harmless.
- **Remote Play:** it has no game ID, so it starts on the default preset and remembers what the player picks there (D35). One choice covers all Remote Play games. Not yet tested on a real console by us; the first reports came from Reddit players. In November 2026 Xbox moved it to `play.xbox.com/remoteplay/<console>`, and the old `/play/consoles/launch/` link now redirects there; 0.1.2 missed the new address (issue #7). Both are recognized from 0.1.3.

## Next up, in order

1. Owner: Google Search Console and Bing; two-step login on Google, GitHub and Vercel.
2. Edge Add-ons, with the same zip.
3. Launch posts (Reddit), with the intro video.
4. Import from ModernKit (the user's exported presets).
5. More tuned presets: Marvel Rivals, Dead by Daylight (survivor and killer), The Witcher 3, Starfield, Kingdom Come: Deliverance II, Fallout 76, Gang Beasts, Madden NFL, College Football, Gears of War.
6. Modifier layers (hold a key to remap others, for example Ctrl plus WASD as the D-pad for Helldivers stratagems).
7. An aim-direction mouse mode for top-down games.
8. Fuller website with per-game pages (`STORE_LISTING.md`), when the owner wants it.
9. Later, maybe: GeForce NOW support, a Firefox build, translations.
