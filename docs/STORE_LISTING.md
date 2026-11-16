# Store listing and discoverability

How people will find the extension, and the copy to use. Based on Chrome's own listing guidance and studies of store ranking (sources in `RESEARCH.md`).

## How Chrome Web Store search works

- Words in the **name**, the 132-character **summary** and the start of the **description** decide what a listing can rank for. The name counts most, and search results cut it off around 35 characters.
- Ranking then follows **ratings** (count matters more than average), **installs versus uninstalls**, **weekly active users**, and listing completeness: screenshots, a promo tile and a video.
- Keyword stuffing gets listings demoted or removed. Repeat a phrase only where it reads naturally.
- Listing pages also rank in Google. Long searches such as "play xcloud with keyboard and mouse chrome" are won by pages with clear, specific text and links from elsewhere.

## Listing copy

**Name (75 max):** `Ghostrol: Keyboard and Mouse for Xbox Cloud Gaming`

The brand comes first, and the rest is the exact phrase people search for. It stays readable as a product name.

**Summary (132 max):**
`Play any Xbox Cloud Gaming game with your keyboard and mouse. Free, open source, presets for every game.`

**Category:** Games (where the competing extensions sit).

**Description:**

> Play Xbox Cloud Gaming (xCloud) with a keyboard and mouse. Ghostrol turns your keys and mouse into a virtual Xbox controller, so every cloud game works, including the ones without mouse support. It is free, has no account or trial, and never sends your data anywhere.
>
> It knows the game you start. Ghostrol reads the game from the page and loads a preset for it automatically: keys made for that game, or a layout for its genre. All 3,658 games in the Xbox Cloud Gaming catalog are covered, and Forza Horizon, Call of Duty, Helldivers 2, Cyberpunk 2077 and more have layouts made for them.
>
> What you get:
> • Keys that ease in, so steering and throttle feel analog, plus a hold key for half-strength movement when sneaking or lockpicking
> • Mouse aim with adjustable speed, response curve, dead zone push and smoothing
> • A steering wheel mode for racing games
> • A test area to try a preset without launching a game
> • Every button can be bound, including the scroll wheel, stick clicks and the Xbox button
> • Games with their own mouse and keyboard support keep using it, so the two never fight
> • Pick up a controller and it takes over; press a key to switch back
> • Works on any keyboard layout, including AZERTY and QWERTZ
> • Presets sync across your computers, with backup and restore
>
> How to use it: open xbox.com/play, start a game, and click the game to capture your mouse. Esc releases it. Alt+K turns Ghostrol off and on.
>
> Privacy: Ghostrol makes no network requests, has no analytics and only runs on Xbox Cloud Gaming pages. The code is open source on GitHub.
>
> Ghostrol is not affiliated with Microsoft or Xbox.

Phrases covered naturally: keyboard and mouse, Xbox Cloud Gaming, xCloud, Game Pass, virtual controller, controller emulator, preset, Chromebook (add a sentence once tested there).

## Images

- **Icon:** the engraved skull over crossed bones with ember eyes (`assets/skull-art.png`, sized by `scripts/make-icons.mjs`). It reads at 16px on light and dark toolbars and looks nothing like competitors, which use controller or keyboard clip art. The full artwork works for the promo tile and landing pages too.
- **Artwork prompts** (written for the skull art; attach the current `skull-art.png` as a reference so new art keeps the same face):

  Main icon:

  > Square 1:1 app icon, 1024 × 1024. A vintage engraved human skull over two crossed bones, front view, perfectly centered, filling about 85% of the canvas with an even empty margin on every side; nothing touches the edges. One bold silhouette: a thick, solid black ink outline (about 3% of the image width) runs around the whole skull-and-bones shape. Inside, hand-inked 1980s skate-deck and tattoo-flash style: aged bone-cream color, strong cross-hatched shadows on one side, a hairline crack across the crown, a heavy angry brow. Large, deep black eye sockets, each holding one bright glowing ember-orange point of light, big enough to stay visible when the icon is tiny. Teeth clearly separated. Favor bold shapes and strong contrast over fine texture. The artwork is fully opaque. Transparent background (if transparency is not available, a flat solid pure white background). No shadow or glow outside the outline, no text, no frame, no border, no gradient.

  Optional flat version for 16 and 32 px (not used yet; `make-icons.mjs` prepares those sizes from the main art):

  > Square 1:1, 512 × 512. The same skull and crossbones as the reference image, same pose, simplified into a tiny toolbar icon: flat colors only, no texture or hatching. Very thick black outline around the whole shape, bone-cream fill, two large bright orange eye dots inside big black sockets, a simple dark nose shape, three dark tooth lines, bones as simple shapes with round knobs at both ends. Centered, filling 90% of the canvas, fully opaque, transparent background. No text, no glow, no gradient.
- **Screenshots (1280×800, five):**
  1. A game being played with the overlay message "Playing with the Forza Horizon preset".
  2. The popup over a game: wide game title, preset, key list.
  3. The preset editor with the test area mid-press.
  4. Mouse tuning with the curve graph.
  5. The games list: "Every cloud game gets a preset".
  Each image gets a short caption in the image itself, the same honey-on-graphite style.
- **Small promo tile (440×280):** the keycap mark with the name.
- **Video (optional, high value):** 30 seconds of launching a game, the preset loading, and playing with the mouse.

## Beyond the store

1. **GitHub README:** the first paragraph repeats the search phrase plainly, with a GIF of play. It links to the store listing and back.
2. **Landing pages generated from preset data:** one page per tuned game, for example "Play Forza Horizon 6 on Xbox Cloud Gaming with keyboard and mouse", showing the real key layout. These are useful pages, not doorway pages: each shows that game's actual layout. Host on GitHub Pages with `SoftwareApplication` structured data. This is the strongest long-tail strategy. (Planned, see `PROGRESS.md`.)
3. **Communities:** a single honest post in r/xcloud, r/XboxGamePass and r/ChromeOS when it launches, showing the free, open-source angle. ModernKit's original growth came from one Reddit post.
4. **Video:** short "play X on a laptop without a controller" tutorials for the top tuned games.
5. **Comparison readers:** answer existing Reddit questions about ModernKit and Better xCloud only where it genuinely helps.

## Ratings, without nagging

After five play sessions, the popup shows one line: "If Ghostrol works well for you, a rating helps other players find it", with **Rate it** and **Not now**. Either choice hides it for good. Reply to every review, especially critical ones.

## Policy notes

- Use "Xbox" only to describe what it works with, never as the name or in the icon. Keep the "not affiliated" line in the description.
- The single-purpose description is "lets people play Xbox Cloud Gaming with a keyboard and mouse".
- Permissions: `storage` only, plus content scripts on xbox.com play pages. Explain both in the privacy form.

## Launch checklist

- [ ] Final name chosen; update `src/shared/brand.ts`, `public/_locales/en/messages.json`, `package.json`
- [ ] GitHub repository created; links updated in `brand.ts`
- [ ] Tested on real Xbox Cloud Gaming by a person (see `PROGRESS.md`)
- [ ] Screenshots and promo tile made from the real build
- [ ] Chrome Web Store developer account ($5 one time)
- [ ] Privacy fields filled in: no data collected
- [ ] `npm run package`, then upload `release/<name>-<version>.zip`
