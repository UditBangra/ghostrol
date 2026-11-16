// Replaces navigator.getGamepads so the site sees a virtual Xbox controller.
//
// Rules from xCloud's web player (see docs/RESEARCH.md):
//   - a pad counts only if connected, with at least 4 axes and 16 buttons
//   - the most recent pad is picked by timestamp, so timestamp moves on every change
//   - two connected pads open a "local multiplayer not supported" dialog, so we never
//     expose the virtual pad and a real one at the same time
// When a real controller is used, it takes over until the keyboard or mouse is used again.

import type { InputEngine } from '../core/engine';

/** The id Chrome gives an Xbox pad on Windows. xCloud uses it to show Xbox button icons. */
const VIRTUAL_ID = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const ACTIVITY_THRESHOLD = 0.35;
const TRIGGER_PRESSED = 0.12;

type GamepadList = (Gamepad | null)[];

export class GamepadShim {
  private readonly readReal: () => GamepadList;
  private engine: InputEngine | null = null;
  private enabled = false;
  private handoff = true;
  private exposed = false;
  private timestamp = 0;
  private realActivityAt = -Infinity;
  private readonly realSeen = new Map<number, number>();
  private handedOff = false;
  /** The pad handed out until the state changes. xCloud asks every 4 ms. */
  private pad: Gamepad | null = null;

  /** Called when the virtual pad appears, disappears or hands off to a real controller. */
  onChange: () => void = () => {};

  constructor() {
    const original =
      typeof navigator.getGamepads === 'function' ? navigator.getGamepads.bind(navigator) : null;
    this.readReal = () => (original ? Array.from(original()) : []);
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      writable: true,
      value: () => this.getGamepads(),
    });
  }

  configure(engine: InputEngine | null, enabled: boolean, handoff: boolean): void {
    this.engine = engine;
    this.pad = null;
    this.handoff = handoff;
    this.enabled = enabled && engine !== null;
    if (!this.enabled) {
      this.setExposed(false);
      this.handedOff = false;
    } else {
      // Show the controller straight away so the site stops asking for one.
      this.getGamepads();
    }
  }

  get isExposed(): boolean {
    return this.exposed;
  }

  get isHandedOff(): boolean {
    return this.handedOff;
  }

  private getGamepads(): GamepadList {
    const real = this.readReal();
    const engine = this.engine;
    if (!this.enabled || !engine) return real;

    const now = performance.now();
    this.trackRealActivity(real, now);
    const useReal = this.handoff && this.realActivityAt > engine.lastInput;
    if (useReal !== this.handedOff) {
      this.handedOff = useReal;
      if (useReal) engine.releaseAll();
    }
    this.setExposed(!useReal);
    if (useReal) return real;

    if (engine.sample(now) || this.timestamp === 0) {
      this.timestamp = now;
      this.pad = null;
    }
    this.pad ??= this.snapshot(engine);
    return [this.pad, null, null, null];
  }

  private trackRealActivity(real: GamepadList, now: number): void {
    for (const pad of real) {
      if (!pad || !pad.connected) continue;
      const last = this.realSeen.get(pad.index) ?? -1;
      if (pad.timestamp <= last) continue;
      this.realSeen.set(pad.index, pad.timestamp);
      const pressed = pad.buttons.some((b) => b.pressed || b.value > 0.5);
      const moved = pad.axes.some((a) => Math.abs(a) > ACTIVITY_THRESHOLD);
      if (last >= 0 && (pressed || moved)) this.realActivityAt = now;
    }
  }

  private snapshot(engine: InputEngine): Gamepad {
    const { axes, buttons } = engine.state;
    const pad = {
      id: VIRTUAL_ID,
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: this.timestamp,
      axes: axes.slice(),
      buttons: buttons.map((value) => ({
        pressed: value > TRIGGER_PRESSED,
        touched: value > 0,
        value,
      })),
      vibrationActuator: null,
      hapticActuators: [],
    };
    return pad as unknown as Gamepad;
  }

  private setExposed(exposed: boolean): void {
    if (exposed === this.exposed) return;
    this.exposed = exposed;
    const event = new Event(exposed ? 'gamepadconnected' : 'gamepaddisconnected');
    if (this.engine) Object.defineProperty(event, 'gamepad', { value: this.snapshot(this.engine) });
    window.dispatchEvent(event);
    this.onChange();
  }
}
