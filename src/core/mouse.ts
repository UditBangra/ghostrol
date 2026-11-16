// Turns relative mouse movement into a stick position.
//
// Camera mode measures mouse speed over a short time window, so the result does not
// depend on monitor refresh rate or how often the site polls the controller. Speed then
// goes through a response curve and an anti-deadzone lift, and is smoothed with a
// time-based filter so the stick eases back to center instead of snapping.
//
// Wheel mode treats horizontal mouse position as the steering angle, which is how a
// mouse steers well in racing games.

import type { MouseSettings } from './preset';

const WINDOW_MS = 24;
const BUFFER_SIZE = 128;
/** Mouse speed in px/ms that gives full deflection at sensitivity 50. */
const FULL_SPEED_AT_50 = 1;
/** Mouse travel in px from center to full lock at sensitivity 50 in wheel mode. */
const WHEEL_TRAVEL_AT_50 = 320;
const SMOOTHING_MAX_TAU_MS = 60;
const SETTLE = 0.002;

export interface StickVector {
  x: number;
  y: number;
}

export class MouseShaper {
  private settings: MouseSettings;
  private readonly times = new Float64Array(BUFFER_SIZE);
  private readonly dxs = new Float64Array(BUFFER_SIZE);
  private readonly dys = new Float64Array(BUFFER_SIZE);
  private head = 0;
  private count = 0;
  private wheelPos = 0;
  private lastSampleAt = -1;
  private readonly out: StickVector = { x: 0, y: 0 };

  constructor(settings: MouseSettings) {
    this.settings = settings;
  }

  setSettings(settings: MouseSettings): void {
    this.settings = settings;
    this.reset();
  }

  move(dx: number, dy: number, now: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (this.settings.mode === 'wheel') {
      const gain = this.settings.sensitivity / 50 / WHEEL_TRAVEL_AT_50;
      this.wheelPos = Math.max(-1, Math.min(1, this.wheelPos + dx * gain));
      return;
    }
    this.times[this.head] = now;
    this.dxs[this.head] = dx;
    this.dys[this.head] = dy;
    this.head = (this.head + 1) % BUFFER_SIZE;
    if (this.count < BUFFER_SIZE) this.count++;
  }

  recenter(): void {
    this.wheelPos = 0;
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
    this.wheelPos = 0;
    this.out.x = 0;
    this.out.y = 0;
    this.lastSampleAt = -1;
  }

  /** Current stick contribution. The returned object is reused between calls. */
  sample(now: number): StickVector {
    const dt = this.lastSampleAt < 0 ? 0 : Math.max(0, now - this.lastSampleAt);
    this.lastSampleAt = now;
    return this.settings.mode === 'wheel' ? this.sampleWheel(dt) : this.sampleCamera(now, dt);
  }

  private sampleCamera(now: number, dt: number): StickVector {
    const s = this.settings;
    let sumX = 0;
    let sumY = 0;
    const since = now - WINDOW_MS;
    for (let i = 0, idx = this.head - 1; i < this.count; i++, idx--) {
      const k = (idx + BUFFER_SIZE) % BUFFER_SIZE;
      if ((this.times[k] ?? 0) <= since) break;
      sumX += this.dxs[k] ?? 0;
      sumY += this.dys[k] ?? 0;
    }

    const gain = (s.sensitivity / 50) * (1 / FULL_SPEED_AT_50);
    let vx = (sumX / WINDOW_MS) * gain;
    let vy = (sumY / WINDOW_MS) * gain * s.yRatio * (s.invertY ? -1 : 1);

    const mag = Math.hypot(vx, vy);
    if (mag > 0) {
      const shaped = shape(Math.min(1, mag), s.curve, s.antiDeadzone);
      vx = (vx / mag) * shaped;
      vy = (vy / mag) * shaped;
    }

    const tau = s.smoothing * SMOOTHING_MAX_TAU_MS;
    const alpha = tau === 0 || dt === 0 ? 1 : 1 - Math.exp(-dt / tau);
    this.out.x = settle(this.out.x + (vx - this.out.x) * alpha);
    this.out.y = settle(this.out.y + (vy - this.out.y) * alpha);
    return this.out;
  }

  private sampleWheel(dt: number): StickVector {
    const s = this.settings;
    if (s.wheelReturn > 0 && dt > 0) {
      this.wheelPos *= Math.exp(-dt * s.wheelReturn * 0.006);
      if (Math.abs(this.wheelPos) < SETTLE) this.wheelPos = 0;
    }
    const mag = Math.abs(this.wheelPos);
    this.out.x = mag === 0 ? 0 : Math.sign(this.wheelPos) * shape(mag, s.curve, s.antiDeadzone);
    this.out.y = 0;
    return this.out;
  }
}

/** Response curve plus anti-deadzone lift for a magnitude in 0..1. */
export function shape(magnitude: number, curve: number, antiDeadzone: number): number {
  if (magnitude <= 0) return 0;
  const curved = Math.pow(Math.min(1, magnitude), curve);
  return antiDeadzone + (1 - antiDeadzone) * curved;
}

function settle(value: number): number {
  return Math.abs(value) < SETTLE ? 0 : value;
}
