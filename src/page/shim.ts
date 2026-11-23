// Replaces navigator.getGamepads so the site sees a virtual Xbox controller.
//
// Rules from xCloud's web player (see docs/RESEARCH.md):
//   - a pad counts only if connected, with at least 4 axes and 16 buttons
//   - the most recent pad is picked by timestamp, so timestamp moves on every change
//   - two connected pads open a "local multiplayer not supported" dialog, so we never
//     expose the virtual pad and a real one at the same time
// When a real controller is used, it takes over until the keyboard or mouse is used again.
//
// The player can also take input from Chrome's gamepadrawinputchanged event instead of
// polling (an origin trial that xbox.com turns on, used when the site's
// enableEventDrivenGamepadInput setting is on). It then never asks for the state again, so
// the virtual pad sends that event for every change too (D36).

import type { InputEngine } from '../core/engine';

/** The id Chrome gives an Xbox pad on Windows. xCloud uses it to show Xbox button icons. */
const VIRTUAL_ID = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const ACTIVITY_THRESHOLD = 0.35;
const TRIGGER_PRESSED = 0.12;
const RAW_EVENT = 'gamepadrawinputchanged';
/** How often changes are looked for and sent as events. The player polls at this rate. */
const RAW_EVENT_MS = 4;

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
  /** The pad last sent in a raw input event, so each change is sent once. */
  private sent: Gamepad | null = null;
  private readonly ownEvents = new WeakSet<Event>();
  private timer: ReturnType<typeof setInterval> | undefined;

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
    // Registered at document start, so this runs before any listener of the site.
    window.addEventListener(RAW_EVENT, this.onRawEvent, true);
  }

  configure(engine: InputEngine | null, enabled: boolean, handoff: boolean): void {
    this.engine = engine;
    this.pad = null;
    this.sent = null;
    this.handoff = handoff;
    this.enabled = enabled && engine !== null;
    if (!this.enabled) {
      this.setExposed(false);
      this.handedOff = false;
      clearInterval(this.timer);
      this.timer = undefined;
    } else {
      // Show the controller straight away so the site stops asking for one.
      this.getGamepads();
      this.timer ??= setInterval(this.sendChanges, RAW_EVENT_MS);
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

  /**
   * Sends each change of the virtual pad as a raw input event, for a player that listens
   * for those instead of polling. Does nothing where Chrome lacks the event, so that a
   * press is only marked as seen once the site could have read it.
   */
  private readonly sendChanges = (): void => {
    if (!(`on${RAW_EVENT}` in window)) return;
    const pad = this.getGamepads()[0];
    if (!this.exposed || !pad || pad === this.sent) return;
    this.sent = pad;
    const event = new Event(RAW_EVENT);
    Object.defineProperty(event, 'gamepad', { value: pad });
    this.ownEvents.add(event);
    window.dispatchEvent(event);
  };

  /**
   * Chrome sends a real controller's raw input events straight to the site. While the
   * virtual pad stands in, they would overwrite its state, so they are held back, unless
   * that controller is taking over.
   */
  private readonly onRawEvent = (event: Event): void => {
    if (this.ownEvents.has(event) || !this.enabled) return;
    this.getGamepads();
    if (this.exposed) event.stopImmediatePropagation();
  };

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
    // A pad that comes back must be sent again, even if its state did not change.
    this.sent = null;
    const event = new Event(exposed ? 'gamepadconnected' : 'gamepaddisconnected');
    if (this.engine) Object.defineProperty(event, 'gamepad', { value: this.snapshot(this.engine) });
    window.dispatchEvent(event);
    this.onChange();
  }
}
