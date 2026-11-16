// Converts keyboard and mouse state into controller state.
//
// Input handlers only record what happened. The controller state is computed in
// sample(now), which the page calls whenever the site asks for gamepads. Analog ramps
// and mouse smoothing advance by the time since the previous sample, so the engine needs
// no timers of its own and adds no delay.

import { MouseShaper } from './mouse';
import type { InputCode } from './inputs';
import type { Preset } from './preset';
import { BUTTONS, BUTTON_COUNT, type Button, type Target } from './targets';

/** How long one wheel notch holds its bound control down. */
export const WHEEL_PULSE_MS = 90;

/**
 * Shortest press the site will see. A quick tap can start and end between two polls of
 * the controller, which would make it invisible, so a release is held back until the
 * press has been read at least once and has lasted this long.
 */
export const MIN_PRESS_MS = 60;

const STICK_DIRS = [
  'lsUp',
  'lsDown',
  'lsLeft',
  'lsRight',
  'rsUp',
  'rsDown',
  'rsLeft',
  'rsRight',
] as const;
type RampSlot = (typeof STICK_DIRS)[number] | 'lt' | 'rt';
const RAMP_SLOTS: readonly RampSlot[] = [...STICK_DIRS, 'lt', 'rt'];
const RAMP_INDEX = Object.fromEntries(RAMP_SLOTS.map((s, i) => [s, i])) as Record<RampSlot, number>;
/** Releasing returns faster than pressing, like a real stick spring. */
const RELEASE_SPEEDUP = 2;
/** A ramp this close to where it is heading counts as there. */
const RAMP_SNAP = 0.01;

export interface ControllerState {
  /** Left X, left Y, right X, right Y, each -1..1. Positive Y is down, as in the Gamepad API. */
  readonly axes: number[];
  /** Button values 0..1 in standard gamepad order. */
  readonly buttons: number[];
}

export class InputEngine {
  private preset!: Preset;
  private index = new Map<InputCode, Target[]>();
  private toggleSet = new Set<Button>();
  private readonly held = new Set<InputCode>();
  /** When each held input went down. */
  private readonly pressedAt = new Map<InputCode, number>();
  /** Held inputs a sample has already reported to the site. */
  private readonly seen = new Set<InputCode>();
  /** Released inputs still shown as held so a quick tap is not lost. */
  private readonly releasing = new Set<InputCode>();
  private readonly pulses = new Map<InputCode, number>();
  private readonly latched = new Set<Button>();
  private readonly active = new Set<Target>();
  private readonly levels = new Float64Array(RAMP_SLOTS.length);
  private readonly mouse: MouseShaper;
  private lastSampleAt = -1;
  private lastInputAt = -Infinity;
  /** State changed since the last sample() call. */
  private dirty = false;

  readonly state: ControllerState = {
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: BUTTON_COUNT }, () => 0),
  };

  constructor(preset: Preset) {
    this.mouse = new MouseShaper(preset.mouse);
    this.setPreset(preset);
  }

  setPreset(preset: Preset): void {
    this.preset = preset;
    const index = new Map<InputCode, Target[]>();
    for (const [target, codes] of Object.entries(preset.bindings) as [Target, InputCode[]][]) {
      for (const code of codes) {
        const list = index.get(code);
        if (list) list.push(target);
        else index.set(code, [target]);
      }
    }
    this.index = index;
    this.toggleSet = new Set(preset.toggles);
    this.mouse.setSettings(preset.mouse);
    this.releaseAll();
  }

  getPreset(): Preset {
    return this.preset;
  }

  isBound(code: InputCode): boolean {
    return this.index.has(code);
  }

  /** What an input is bound to, for display. */
  targetsOf(code: InputCode): readonly Target[] {
    return this.index.get(code) ?? [];
  }

  get mouseEnabled(): boolean {
    return this.preset.mouse.target !== 'none';
  }

  /** Time of the most recent keyboard or mouse input, for real controller handoff. */
  get lastInput(): number {
    return this.lastInputAt;
  }

  /** Returns true when the code is bound, so the caller can stop the browser default. */
  press(code: InputCode, now: number): boolean {
    const targets = this.index.get(code);
    if (!targets) return false;
    this.lastInputAt = now;
    if (this.held.has(code)) {
      // Still down (key repeat), unless a quick tap was being held back: then it is a new press.
      if (!this.releasing.delete(code)) return true;
    } else {
      // Bring ramps up to this moment so easing starts exactly at the key press.
      this.advanceTo(now);
      this.held.add(code);
    }
    this.pressedAt.set(code, now);
    for (const target of targets) {
      if (target === 'recenter') this.mouse.recenter();
      else if (this.toggleSet.has(target as Button)) this.flipLatch(target as Button);
    }
    return true;
  }

  release(code: InputCode, now: number): boolean {
    if (!this.index.has(code)) return false;
    this.lastInputAt = now;
    this.advanceTo(now);
    if (!this.held.has(code)) return true;
    if (this.shownLongEnough(code, now)) this.drop(code);
    else this.releasing.add(code);
    return true;
  }

  private shownLongEnough(code: InputCode, now: number): boolean {
    return this.seen.has(code) && now - (this.pressedAt.get(code) ?? -Infinity) >= MIN_PRESS_MS;
  }

  private drop(code: InputCode): void {
    this.held.delete(code);
    this.pressedAt.delete(code);
    this.seen.delete(code);
    this.releasing.delete(code);
  }

  /** A wheel notch presses its control briefly. */
  pulse(code: InputCode, now: number): boolean {
    const targets = this.index.get(code);
    if (!targets) return false;
    this.lastInputAt = now;
    this.advanceTo(now);
    if (!this.pulses.has(code)) {
      for (const target of targets) {
        if (this.toggleSet.has(target as Button)) this.flipLatch(target as Button);
        else if (target === 'recenter') this.mouse.recenter();
      }
    }
    this.pulses.set(code, now + WHEEL_PULSE_MS);
    return true;
  }

  moveMouse(dx: number, dy: number, now: number): void {
    if (!this.mouseEnabled) return;
    this.lastInputAt = now;
    this.mouse.move(dx, dy, now);
  }

  /** Lets go of everything. Called on focus loss, mouse release and preset changes. */
  releaseAll(): void {
    this.held.clear();
    this.pressedAt.clear();
    this.seen.clear();
    this.releasing.clear();
    this.pulses.clear();
    this.latched.clear();
    this.levels.fill(0);
    this.mouse.reset();
    this.lastSampleAt = -1;
  }

  /**
   * Computes controller state for this moment. Returns true if it changed since the
   * previous call to sample, including changes made while handling input in between.
   */
  sample(now: number): boolean {
    this.advanceTo(now);
    // Everything held now has been reported to the site at least once.
    for (const code of this.held) this.seen.add(code);
    const changed = this.dirty;
    this.dirty = false;
    return changed;
  }

  /** Advances ramps, smoothing and outputs to the given time. */
  private advanceTo(now: number): void {
    const dt = this.lastSampleAt < 0 ? 0 : Math.max(0, now - this.lastSampleAt);
    this.lastSampleAt = now;
    for (const code of this.releasing) {
      if (this.shownLongEnough(code, now)) this.drop(code);
    }
    this.collectActive(now);

    const { analog } = this.preset;
    const precise = this.active.has('precision');
    const scale = precise ? analog.precision : 1;

    for (const slot of RAMP_SLOTS) {
      const isTrigger = slot === 'lt' || slot === 'rt';
      this.advance(
        RAMP_INDEX[slot],
        this.active.has(slot),
        isTrigger ? analog.triggerRampMs : analog.stickRampMs,
        dt,
      );
    }

    let changed = false;
    const { buttons, axes } = this.state;
    for (let i = 0; i < BUTTON_COUNT; i++) {
      const name = BUTTONS[i] as Button;
      let value: number;
      if (name === 'lt' || name === 'rt') {
        value = round((this.levels[RAMP_INDEX[name]] ?? 0) * scale);
      } else {
        value = this.active.has(name) ? 1 : 0;
      }
      if (buttons[i] !== value) {
        buttons[i] = value;
        changed = true;
      }
    }

    const mouse = this.mouseEnabled ? this.mouse.sample(now) : null;
    const left = this.stickFromKeys('ls', scale);
    const right = this.stickFromKeys('rs', scale);
    if (mouse) {
      const into = this.preset.mouse.target === 'left' ? left : right;
      into[0] += mouse.x;
      into[1] += mouse.y;
    }
    changed = writeStick(axes, 0, left) || changed;
    changed = writeStick(axes, 2, right) || changed;
    if (changed) this.dirty = true;
  }

  private collectActive(now: number): void {
    const active = this.active;
    active.clear();
    for (const code of this.held) this.addTargets(code);
    for (const [code, until] of this.pulses) {
      if (until <= now) this.pulses.delete(code);
      else this.addTargets(code);
    }
    for (const button of this.latched) active.add(button);
  }

  private addTargets(code: InputCode): void {
    const targets = this.index.get(code);
    if (!targets) return;
    for (const target of targets) {
      // Toggle buttons are driven by their latch, not by being held.
      if (!this.toggleSet.has(target as Button)) this.active.add(target);
    }
  }

  private flipLatch(button: Button): void {
    if (this.latched.has(button)) this.latched.delete(button);
    else this.latched.add(button);
  }

  /**
   * Moves a ramp toward on or off. The curve eases out: most of the travel happens right
   * after the key press, so the press is felt at once, and the rest settles smoothly.
   * rampMs is the time to reach 95%.
   */
  private advance(slot: number, on: boolean, rampMs: number, dt: number): void {
    const goal = on ? 1 : 0;
    if (rampMs <= 0) {
      this.levels[slot] = goal;
      return;
    }
    const tau = rampMs / 3 / (on ? 1 : RELEASE_SPEEDUP);
    const next = goal + ((this.levels[slot] ?? 0) - goal) * Math.exp(-dt / tau);
    this.levels[slot] = Math.abs(goal - next) < RAMP_SNAP ? goal : next;
  }

  private stickFromKeys(stick: 'ls' | 'rs', scale: number): [number, number] {
    const level = (dir: (typeof STICK_DIRS)[number]) => this.levels[RAMP_INDEX[dir]] ?? 0;
    let x = level(`${stick}Right`) - level(`${stick}Left`);
    let y = level(`${stick}Down`) - level(`${stick}Up`);
    const mag = Math.hypot(x, y);
    // Two keys at once point diagonally at full strength, not past the edge of the stick.
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return [x * scale, y * scale];
  }
}

function writeStick(axes: number[], offset: number, [x, y]: [number, number]): boolean {
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  x = round(x);
  y = round(y);
  const changed = axes[offset] !== x || axes[offset + 1] !== y;
  axes[offset] = x;
  axes[offset + 1] = y;
  return changed;
}

/** Rounds away float noise so tiny drifts do not count as changes. */
function round(value: number): number {
  const r = Math.round(value * 10000) / 10000;
  return r === 0 ? 0 : r;
}
