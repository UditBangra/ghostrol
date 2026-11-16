# Design

## Direction

The product turns a keyboard into a controller, so the interface is made from keyboard materials: a graphite case, keycaps with a lighter top face and a darker skirt, warm off-white legends, and a single honey accent used the way a keyboard uses its one accent key. Controls that you press look like keys and move like keys.

The memorable moment is the keycap itself: real-looking keys that depress when you press them, on the welcome page, in the preset editor and in the test area. Everything around it stays quiet.

Over that sits the ghost of the name (D23): the name is set in blackletter, and the mark is a skull over crossed bones drawn like old engraving and tattoo flash. The haunting stays in the brand and the fire. Controls, keycaps and body text stay plain, so nothing gets harder to use.

## Tokens (`src/ui/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--case` | `#1b1d22` | page background |
| `--plate` | `#22252b` | panels |
| `--well` | `#17191d` | recessed areas: inputs, tracks, switch wells |
| `--cap`, `--cap-top`, `--cap-edge` | `#30333b`, `#3a3e47`, `#15171b` | keycap face, highlight, skirt |
| `--legend`, `--legend-dim`, `--legend-faint` | `#ece6d6`, `#aaa596`, `#727068` | text |
| `--honey`, `--honey-deep`, `--honey-ink` | `#f2b13a`, `#b57d16`, `#2b1d04` | the one accent: primary action, on states, focus |
| `--pad-a` to `--pad-y` | muted green, red, blue, yellow | only on A, B, X and Y glyphs |

Radius follows a hierarchy: keycaps 7px, controls 6px, panels 12px.

## Type

Archivo, one variable family, at two widths. Headings use the expanded width (`font-stretch: 122%`) at weights 700 to 800; body text uses the normal width at 450. Tabular numbers everywhere. No monospace anywhere, including `<kbd>`.

The name is the one exception: **UnifrakturMaguntia**, a blackletter (`--font-brand`), with its G taken from **Pirata One**, used only for the word Ghostrol through the `Wordmark` component. It is never used for headings, game titles or anything a player has to read quickly. Blackletter is slow to read in a sentence; in one familiar word it is pure mood.

Scale: 11.5, 12.5, 14, 17, 24, 34 px.

## The mark and the wordmark

- **Mark:** an engraved skull over crossed bones with ember eyes (`assets/skull-art.png`). `npm run icons` makes every size from it: 48 px and up are a clean resize; 16 and 32 px get more contrast, a one-pixel ink outline so the shape holds on light toolbars, and the eyes painted back in. Inside the extension use `icons/128.png` up to 64 px on screen and `icons/256.png` above that, so it stays sharp on high-density screens.
- **Wordmark:** `<Wordmark />` sets the name in blackletter in bone, with a hard black drop. It does not move. UnifrakturMaguntia's fraktur G reads like a C, so the G alone comes from Pirata One through a font face limited to that letter.
- **In game:** the overlay shows the mark in its messages and the controls panel, never the wordmark, because the page may block extension fonts. If the page also blocks the icon image, the overlay draws a simpler skull from `assets/mark.svg` instead.

## Components

- **Keycap** (`.cap`): a top-face gradient, an inset skirt, and a 2px press when down. Variants: small, accent.
- **Switch**: a small keycap sliding in a well, honey when on.
- **Slider**: a recessed track filled with honey, with a keycap thumb.
- **Segmented control**: options in a well; the chosen one becomes a keycap.
- **Glyph**: controller buttons. Face buttons use their colors, everything else is neutral.
- **Controller drawing**: a schematic pad that lights what is pressed, moves its sticks, fills its triggers, and can be clicked to find a binding.

## Rules we hold to

These come from studying what makes interfaces look machine-generated (sources in `RESEARCH.md`).

- No gradient backgrounds, glow blobs or glassmorphism. Depth comes from the keycap skirt and hairlines.
- No purple, and no near-black plus neon. The palette is warm graphite with one honey accent.
- No three identical cards in a row, no icon-in-a-tinted-square, no emoji as icons.
- No all-caps eyebrow labels, no labels joined by middle dots, no arrows appended to buttons, no gradient text, no single word highlighted in a heading.
- Numbers appear only for a real sequence (the three setup steps), and they are keycaps.
- Motion only answers the user: key presses, toggles, a message appearing, a view opening. Respect `prefers-reduced-motion`.
- Things that move travel with `--glide` over `--glide-ms` (340 ms): fast away, soft landing. A chosen option's keycap slides to the new choice (`Segmented`, the sidebar), and settings that a choice brings in open to their height (`Reveal`). Never pop content in that a choice reveals.
- Locked controls look locked: grey slider tracks, no grab cursor, and a note saying why with the way to change it.
- One deliberate exception: the fire around the popup and under the welcome keyboard, which the owner asked for (D21). It stays at the edges, adds light without hiding anything, and can be turned off. It burns as ember fire or as pale ghost fire (D23).
- The theme stays out of the way of reading: blackletter only for the name, and no skulls, cobwebs or dripping type sprinkled through the interface.
- Over the game, no blurred shadows (D20). Use hard skirts and hairlines.
- Every interactive element has a visible honey focus ring.

## Writing

- Plain words, sentence case, active voice. Say what happens: "Make a copy to edit", "Save backup".
- Name things the way players do: "Mouse speed", not "sensitivity multiplier"; "Made for this game", not "tuned preset".
- One idea per line of copy. No hype, no superlatives, no "seamless", "unlock" or "level up".
- No em dashes. Use a period, a comma or a colon.
- Errors say what went wrong and what to do. Empty states say what to do next.
- Keep the same word for the same thing everywhere: preset, layout, Studio, capture.

## Review checklist

Before shipping interface work, run `npm run shots` and look at `.cache/shots`:

1. Does anything look like a template, or like it could belong to any product?
2. Is honey used for more than one job on a screen?
3. Is there any monospace text, all-caps label or em dash?
4. Do keycaps read as keys at a glance?
5. Is the main action obvious within two seconds?
