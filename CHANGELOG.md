# Changelog

What changed in each release. Every store upload needs a higher version than the last.

## 0.1.3 (23 November 2026)

- Remote Play works again. Xbox moved it to play.xbox.com/remoteplay, and Ghostrol did not recognize the new address, so the popup said "Pick a game" and no keys worked.
- Ready for a change Xbox is testing in its new player: reading the controller from events instead of asking for it. Ghostrol now sends those events too, so your keys keep working if Xbox turns it on for you.
- Game pages on play.xbox.com show that game in the popup again, so you can pick its preset before you start.
- The popup flame burns at full strength while you play through Remote Play, as it does for cloud games.

## 0.1.2 (21 November 2026)

- Remote Play from your own console now has its own preset choice. Pick any preset in the popup or the controls panel (Alt+C), or cycle with Alt+Period, and Ghostrol remembers it for the next session. Before, Remote Play always used your default preset and Alt+Period did nothing.
- New GTA 6 presets for Remote Play: one on foot, and one for driving with W and S. Alt+Period flips between them.
- The popup no longer says "Starts when you launch the game" while you are already playing through Remote Play.

## 0.1.1 (19 November 2026)

- Rate it in the popup now opens Ghostrol's own Chrome Web Store page. In 0.1.0 it opened the store's home page.
- Removing Ghostrol opens a short page at ghostrol.com asking why, with each reason linked to a pre-filled GitHub form. The extension still sends nothing.

## 0.1.0 (16 November 2026, on the Chrome Web Store 19 November)

First public release.

- A virtual Xbox controller for Xbox Cloud Gaming, driven by keyboard and mouse.
- Layouts for every cloud game by genre, plus tuned presets for popular games.
- Keys that ease in, a precision key, and mouse aim with speed, curve, dead zone push and smoothing.
- Stands by in games with their own mouse and keyboard support, with a per-game choice to use Ghostrol anyway.
- Controls panel over the game (Alt+C), key display, preset maker and the Studio.
- Report a problem in the popup opens a GitHub issue with the version, browser, game and preset filled in.
- No network requests, no analytics, no account.
- Free software under the GNU General Public License, version 3.
