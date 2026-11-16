import { BRAND } from '../shared/brand';
import type { FlameColor } from '../shared/settings';
import { Keycap, Wordmark } from '../ui/components';
import { FireBorder } from '../ui/FireBorder';
import { useLayoutMap, usePressedInputs } from '../ui/hooks';

const DEMO_ROW = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];
const DEMO_HOME = ['KeyA', 'KeyS', 'KeyD', 'KeyF'];

export function WelcomeView({ fire }: { fire: FlameColor | null }) {
  const layout = useLayoutMap();
  const pressed = usePressedInputs(true);
  const cap = (code: string, accent = false) => (
    <Keycap key={code} code={code} layout={layout} accent={accent} down={pressed.has(code)} />
  );

  return (
    <div class="welcome">
      <header class="welcome-brand">
        <img src="icons/256.png" width="96" height="96" alt="" />
        <div>
          <h1>
            <Wordmark />
          </h1>
          <p class="dim">{BRAND.tagline}</p>
        </div>
      </header>
      <section class="welcome-intro">
        <div class="demo-board" aria-hidden="true">
          {fire && <FireBorder power={0.7} ghost={fire === 'ghost'} contained />}
          <div class="demo-row">{DEMO_ROW.map((c) => cap(c, c === 'KeyW'))}</div>
          <div class="demo-row offset">{DEMO_HOME.map((c) => cap(c))}</div>
          <div class="demo-row space">{cap('Space')}</div>
        </div>
        <div>
          <h2 class="wide">Your keyboard is the controller now.</h2>
          <p class="dim">
            {BRAND.name} turns your keys and mouse into an Xbox controller for Xbox Cloud Gaming. It
            knows thousands of games and loads the right keys when you start one. Try pressing some
            keys.
          </p>
        </div>
      </section>

      <ol class="steps">
        <li>
          <Keycap code="Digit1" layout={layout} />
          <h2>Pin it</h2>
          <p class="dim">
            Click the puzzle piece in Chrome's toolbar and pin {BRAND.name}. One click shows the
            keys for the game you're in.
          </p>
        </li>
        <li>
          <Keycap code="Digit2" layout={layout} />
          <h2>Start a game</h2>
          <p class="dim">
            Open{' '}
            <a href="https://www.xbox.com/play" target="_blank" rel="noreferrer">
              xbox.com/play
            </a>{' '}
            and launch any game. A short note at the top tells you which preset loaded.
          </p>
        </li>
        <li>
          <Keycap code="Digit3" layout={layout} />
          <h2>Click the game</h2>
          <p class="dim">
            That captures your mouse for looking and aiming. Esc gives it back whenever you need it.
          </p>
        </li>
      </ol>

      <section class="facts">
        <div>
          <p>
            <Keycap code="AltLeft" layout={layout} small />{' '}
            <Keycap code="KeyK" layout={layout} small /> turns {BRAND.name} off and on.
          </p>
          <p>
            <Keycap code="AltLeft" layout={layout} small />{' '}
            <Keycap code="Period" layout={layout} small /> switches to the next preset for the game.
          </p>
          <p>
            <Keycap code="AltLeft" layout={layout} small />{' '}
            <Keycap code="KeyC" layout={layout} small /> shows every key over the game, even in full
            screen. Hold it to peek.
          </p>
        </div>
        <div>
          <p>Pick up a controller and it takes over. Press a key and you're back.</p>
          <p>Games with their own mouse support use it, unless you choose {BRAND.name} instead.</p>
        </div>
      </section>

      <a class="btn primary" href="#presets">
        See the presets
      </a>
    </div>
  );
}
