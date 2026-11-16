import { describe, expect, it } from 'vitest';
import { MouseShaper, shape } from '../src/core/mouse';
import { DEFAULT_MOUSE, type MouseSettings } from '../src/core/preset';

const linear: MouseSettings = {
  ...DEFAULT_MOUSE,
  curve: 1,
  antiDeadzone: 0,
  smoothing: 0,
  sensitivity: 50,
};

/** Feeds a steady mouse speed in px/ms, sampling at the given interval. */
function run(settings: MouseSettings, speed: number, sampleEvery: number, until = 200) {
  const m = new MouseShaper(settings);
  let last = { x: 0, y: 0 };
  for (let t = 1; t <= until; t++) {
    m.move(speed, 0, t);
    if (t % sampleEvery === 0) last = { ...m.sample(t) };
  }
  return last;
}

describe('MouseShaper camera mode', () => {
  it('gives the same stick for the same speed at different poll rates', () => {
    const slow = run(linear, 0.5, 16);
    const fast = run(linear, 0.5, 4);
    expect(slow.x).toBeCloseTo(0.5, 2);
    expect(fast.x).toBeCloseTo(0.5, 2);
  });

  it('scales with sensitivity and caps at full deflection', () => {
    expect(run({ ...linear, sensitivity: 25 }, 0.5, 8).x).toBeCloseTo(0.25, 2);
    expect(run({ ...linear, sensitivity: 100 }, 2, 8).x).toBe(1);
  });

  it('returns to center after the mouse stops', () => {
    const m = new MouseShaper(linear);
    for (let t = 1; t <= 50; t++) m.move(1, 0, t);
    expect(m.sample(50).x).toBeGreaterThan(0);
    expect(m.sample(100).x).toBe(0);
  });

  it('eases back to center when smoothing is on', () => {
    const m = new MouseShaper({ ...linear, smoothing: 0.5 });
    for (let t = 1; t <= 100; t++) {
      m.move(1, 0, t);
      m.sample(t);
    }
    const after = m.sample(110).x;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(1);
    for (let t = 111; t < 400; t++) m.sample(t);
    expect(m.sample(400).x).toBe(0);
  });

  it('inverts vertical movement when asked', () => {
    const m = new MouseShaper({ ...linear, invertY: true });
    m.move(0, 5, 1);
    expect(m.sample(2).y).toBeLessThan(0);
  });
});

describe('MouseShaper wheel mode', () => {
  const wheel: MouseSettings = { ...linear, mode: 'wheel', wheelReturn: 0 };

  it('holds the wheel where the mouse left it', () => {
    const m = new MouseShaper(wheel);
    m.move(160, 0, 1);
    expect(m.sample(2).x).toBeCloseTo(0.5, 2);
    expect(m.sample(500).x).toBeCloseTo(0.5, 2);
  });

  it('clamps at full lock and recenters on request', () => {
    const m = new MouseShaper(wheel);
    m.move(5000, 0, 1);
    expect(m.sample(2).x).toBe(1);
    m.recenter();
    expect(m.sample(3).x).toBe(0);
  });

  it('drifts back to center when return is on', () => {
    const m = new MouseShaper({ ...wheel, wheelReturn: 1 });
    m.move(160, 0, 1);
    m.sample(1);
    expect(m.sample(200).x).toBeLessThan(0.5);
  });
});

describe('shape', () => {
  it('lifts small movements past the dead zone', () => {
    expect(shape(0.01, 1, 0.15)).toBeGreaterThan(0.15);
    expect(shape(0, 1, 0.15)).toBe(0);
    expect(shape(1, 0.8, 0.15)).toBeCloseTo(1, 6);
  });
});
