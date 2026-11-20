# Ghostrol: keyboard and mouse for Xbox Cloud Gaming

Play any Xbox Cloud Gaming (xCloud) game with a keyboard and mouse in Chrome or Edge. Ghostrol is a free, open-source browser extension that turns your keys and mouse into a virtual Xbox controller. It recognizes the game you launch and loads keys made for it.

[![Watch the 36 second intro on YouTube](https://ghostrol.com/img/intro-poster.jpg)](https://www.youtube.com/watch?v=GDyVCLB7WDg)

[Watch the intro on YouTube](https://www.youtube.com/watch?v=GDyVCLB7WDg) · [ghostrol.com](https://ghostrol.com)

## What it does

- **Works with every cloud game.** The game sees a normal Xbox controller, so it does not need its own mouse support.
- **Knows the game you're playing.** It reads the game from the page and picks a preset automatically: a layout tuned for that game, or one for its genre. All 3,658 games in the Xbox Cloud Gaming catalog are covered.
- **Keys that feel analog.** Steering eases in instead of slamming to full lock, throttle answers at once, and a precision key gives half-strength sticks for sneaking, aiming and lockpicking.
- **Your keys over the game.** Hold Alt+C to see every key next to its controller button, even in full screen. Tap it to keep the panel open and switch presets or mouse speed without leaving the game.
- **See what you press.** An optional corner display shows each key and the button it pressed, or the sticks and triggers.
- **Make your own.** A three-step preset maker in the Studio: pick the game, pick a starting point, name it.
- **Mouse aim that holds up.** Speed is measured in real time, not per screen frame, so it feels the same on any monitor. Response curve, dead zone push and smoothing are all adjustable, with a live graph.
- **Steering wheel mode.** In racing games the mouse can steer like a wheel that stays where you leave it.
- **Plays nicely with Xbox.** Games with their own mouse and keyboard support use it, so the two never fight. If you pick Ghostrol for one of them anyway, it stays in charge in full screen too. Pick up a controller and it takes over instantly.
- **Free, private, no account.** No trial, no paywall, no analytics, no network requests.

## Install

**Chrome Web Store:** [Ghostrol on the Chrome Web Store](https://chromewebstore.google.com/detail/enbejgjcnknlmempckoelehnhkagmngj)

**From GitHub:**

1. Download the latest `ghostrol-x.y.z.zip` from [Releases](https://github.com/UditBangra/ghostrol/releases) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.
4. Open [xbox.com/play](https://www.xbox.com/play), start a game, and click the game to capture your mouse.

## Using it

| Key | What it does |
| --- | --- |
| Click the game | Captures the mouse for looking and aiming |
| Esc | Gives the mouse back |
| Alt+K | Turns Ghostrol off and on |
| Alt+Period | Switches to the next preset for this game |
| Alt+C | Shows the keys over the game. Hold to peek, tap to keep open |

The toolbar button shows the keys for the game you're in. The **Studio** (right-click the button, then Options) lets you edit presets, tune the mouse, try a preset without launching a game, and choose a preset for any game.

## Questions

**Will I get banned?** Xbox sees an ordinary controller, and the xCloud team has said they do not ban people for using third-party clients or extensions. Individual games may treat mouse aim in online matches as unfair, the same as hardware adapters, so use it with care in competitive shooters.

**Does it add input lag?** No. The controller state is computed at the moment the site reads it, with no timers or queues in between.

**Does it work on a Chromebook?** Yes. It needs Chrome or Edge on a desktop or laptop. Phones and tablets cannot capture the mouse.

**A game ignores small mouse movements.** Raise **Dead zone push** in the Studio, or lower the dead zone in the game's own settings.

## Develop

```bash
npm install
npm run build      # build into dist/
npm run dev        # rebuild on change
npm test           # unit tests
npm run e2e        # load the built extension in Chromium and check it end to end
npm run catalog    # refresh the game catalog from Microsoft's public endpoints
npm run icons      # rebuild the icons from assets/skull-art.png
npm run package    # zip dist/ for the Chrome Web Store
```

Start with [CLAUDE.md](CLAUDE.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Presets are explained in [docs/PRESETS.md](docs/PRESETS.md), and contributions in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright (C) 2026 Udit Bangra

Ghostrol is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License, version 3, as published by the Free Software Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

In short: you may use, study, change and share Ghostrol. If you share a changed version, it has to stay under the GPL with its full source code, and keep this copyright notice.

Ghostrol is not affiliated with Microsoft or Xbox. Xbox is a trademark of Microsoft.
