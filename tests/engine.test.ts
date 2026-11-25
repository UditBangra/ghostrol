import { describe, expect, it } from 'vitest';
import { InputEngine, MIN_PRESS_MS, WHEEL_PULSE_MS } from '../src/core/engine';
import { DEFAULT_ANALOG, DEFAULT_MOUSE, type Preset } from '../src/core/preset';
import { BUTTON_INDEX } from '../src/core/targets';

function preset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: 'test',
    name: 'Test',
    bindings: {
      a: ['Space'],
      rt: ['Mouse0'],
      lt: ['KeyS'],
      lsUp: ['KeyW'],
      lsDown: ['KeyS'],
      lsLeft: ['KeyA'],
      lsRight: ['KeyD'],
      y: ['WheelUp'],
      precision: ['AltLeft'],
    },
    labels: {},
    toggles: [],
    mouse: { ...DEFAULT_MOUSE, target: 'none' },
    analog: { ...DEFAULT_ANALOG },
    ...overrides,
  };
}

const button = (engine: InputEngine, name: keyof typeof BUTTON_INDEX) =>
  engine.state.buttons[BUTTON_INDEX[name]];

describe('InputEngine', () => {
  it('presses and releases a bound button', () => {
    const engine = new InputEngine(preset());
    expect(engine.press('Space', 0)).toBe(true);
    engine.sample(0);
    expect(button(engine, 'a')).toBe(1);
    engine.release('Space', MIN_PRESS_MS + 10);
    engine.sample(MIN_PRESS_MS + 10);
    expect(button(engine, 'a')).toBe(0);
  });

  it('keeps a quick tap visible until the site has read it', () => {
    const engine = new InputEngine(preset());
    engine.sample(0);
    // Pressed and released between two polls.
    engine.press('Space', 5);
    engine.release('Space', 8);
    expect(engine.sample(16)).toBe(true);
    expect(button(engine, 'a')).toBe(1);
    engine.sample(32);
    expect(button(engine, 'a')).toBe(1);
    engine.sample(5 + MIN_PRESS_MS);
    expect(button(engine, 'a')).toBe(0);
  });

  it('counts a second quick tap as a new press', () => {
    const engine = new InputEngine(preset({ toggles: ['a'] }));
    engine.press('Space', 0);
    engine.release('Space', 3);
    engine.press('Space', 6);
    engine.release('Space', 9);
    engine.sample(100);
    // Two presses of a toggle leave it off.
    expect(button(engine, 'a')).toBe(0);
  });

  it('ignores unbound keys so the page keeps them', () => {
    const engine = new InputEngine(preset());
    expect(engine.press('KeyZ', 0)).toBe(false);
    expect(engine.isBound('KeyZ')).toBe(false);
  });

  it('reports whether the state changed', () => {
    const engine = new InputEngine(preset());
    expect(engine.sample(0)).toBe(false);
    engine.press('Space', 1);
    expect(engine.sample(1)).toBe(true);
    expect(engine.sample(2)).toBe(false);
  });

  it('points diagonals at full strength without going past the edge', () => {
    const engine = new InputEngine(preset());
    engine.press('KeyW', 0);
    engine.press('KeyD', 0);
    engine.sample(0);
    const [x, y] = engine.state.axes as [number, number];
    expect(Math.hypot(x, y)).toBeCloseTo(1, 3);
    expect(x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(y).toBeCloseTo(-Math.SQRT1_2, 3);
  });

  it('cancels opposite directions', () => {
    const engine = new InputEngine(preset());
    engine.press('KeyA', 0);
    engine.press('KeyD', 0);
    engine.sample(0);
    expect(engine.state.axes[0]).toBe(0);
  });

  it('ramps sticks over time when a ramp is set', () => {
    const engine = new InputEngine(preset({ analog: { ...DEFAULT_ANALOG, stickRampMs: 100 } }));
    engine.sample(0);
    engine.press('KeyD', 0);
    engine.sample(100);
    expect(engine.state.axes[0]).toBeCloseTo(0.95, 2);
    engine.sample(1000);
    expect(engine.state.axes[0]).toBe(1);
  });

  it('moves most of the way early, so a press is felt at once', () => {
    const engine = new InputEngine(preset({ analog: { ...DEFAULT_ANALOG, stickRampMs: 150 } }));
    engine.sample(0);
    engine.press('KeyD', 0);
    // One 60 Hz frame after the press, well past a tenth of the way.
    engine.sample(16);
    expect(engine.state.axes[0]).toBeGreaterThan(0.25);
    engine.sample(50);
    expect(engine.state.axes[0]).toBeGreaterThan(0.6);
  });

  it('presses triggers fully at once when their ramp is off', () => {
    const engine = new InputEngine(preset({ analog: { ...DEFAULT_ANALOG, triggerRampMs: 0 } }));
    engine.press('Mouse0', 0);
    engine.sample(0);
    expect(button(engine, 'rt')).toBe(1);
  });

  it('starts easing at the key press, not at the previous poll', () => {
    const engine = new InputEngine(preset({ analog: { ...DEFAULT_ANALOG, stickRampMs: 100 } }));
    engine.sample(0);
    engine.press('KeyD', 90);
    engine.sample(100);
    expect(engine.state.axes[0]).toBeCloseTo(1 - Math.exp(-10 / (100 / 3)), 3);
  });

  it('reports changes made between polls', () => {
    const engine = new InputEngine(preset());
    engine.sample(0);
    engine.press('Space', 5);
    engine.release('Space', 6);
    // The press and release both happened since the last poll, so the site must hear about it.
    expect(engine.sample(10)).toBe(true);
  });

  it('returns to center faster than it ramps up', () => {
    const engine = new InputEngine(preset({ analog: { ...DEFAULT_ANALOG, stickRampMs: 100 } }));
    engine.sample(0);
    engine.press('KeyD', 0);
    engine.sample(1000);
    engine.release('KeyD', 1000);
    // Half the ramp time gets it 95% of the way back.
    engine.sample(1050);
    expect(engine.state.axes[0]).toBeLessThan(0.06);
    engine.sample(1100);
    expect(engine.state.axes[0]).toBe(0);
  });

  it('scales sticks and triggers while precision is held', () => {
    const engine = new InputEngine(preset({ analog: { ...DEFAULT_ANALOG, precision: 0.5 } }));
    engine.press('AltLeft', 0);
    engine.press('KeyD', 0);
    engine.press('KeyS', 0);
    engine.sample(0);
    const [x, y] = engine.state.axes as [number, number];
    expect(Math.hypot(x, y)).toBeCloseTo(0.5, 3);
    expect(button(engine, 'lt')).toBe(0.5);
  });

  it('latches toggle buttons', () => {
    const engine = new InputEngine(preset({ toggles: ['a'] }));
    engine.press('Space', 0);
    engine.release('Space', 5);
    engine.sample(10);
    expect(button(engine, 'a')).toBe(1);
    engine.press('Space', 20);
    engine.release('Space', 25);
    engine.sample(30);
    expect(button(engine, 'a')).toBe(0);
  });

  it('turns a wheel notch into a short press', () => {
    const engine = new InputEngine(preset());
    expect(engine.pulse('WheelUp', 0)).toBe(true);
    engine.sample(1);
    expect(button(engine, 'y')).toBe(1);
    engine.sample(WHEEL_PULSE_MS + 1);
    expect(button(engine, 'y')).toBe(0);
  });

  it('presses every target bound to one key, so one key can play a chord', () => {
    const engine = new InputEngine(preset({ bindings: { lb: ['KeyX'], rb: ['KeyX'] } }));
    engine.press('KeyX', 0);
    engine.sample(0);
    expect(button(engine, 'lb')).toBe(1);
    expect(button(engine, 'rb')).toBe(1);
  });

  describe('combo keys', () => {
    const delay = DEFAULT_ANALOG.comboDelayMs;
    const combo = (comboDelayMs = delay) =>
      new InputEngine(
        preset({
          bindings: { lt: ['KeyQ'], y: ['KeyQ'], lb: ['WheelUp'], a: ['WheelUp'] },
          analog: { ...DEFAULT_ANALOG, comboDelayMs },
        }),
      );

    it('presses the trigger first and the other button after the delay', () => {
      const engine = combo();
      engine.press('KeyQ', 0);
      engine.sample(0);
      expect(button(engine, 'lt')).toBe(1);
      expect(button(engine, 'y')).toBe(0);
      engine.sample(delay - 1);
      expect(button(engine, 'y')).toBe(0);
      expect(engine.sample(delay)).toBe(true);
      expect(button(engine, 'lt')).toBe(1);
      expect(button(engine, 'y')).toBe(1);
      engine.release('KeyQ', delay + 200);
      engine.sample(delay + 200);
      expect(button(engine, 'lt')).toBe(0);
      expect(button(engine, 'y')).toBe(0);
    });

    it('plays the whole combo on a quick tap', () => {
      const engine = combo();
      engine.press('KeyQ', 0);
      engine.release('KeyQ', 10);
      engine.sample(20);
      expect(button(engine, 'lt')).toBe(1);
      expect(button(engine, 'y')).toBe(0);
      // Skipping past the delay still shows the button at least once.
      engine.sample(delay + MIN_PRESS_MS + 50);
      expect(button(engine, 'lt')).toBe(1);
      expect(button(engine, 'y')).toBe(1);
      engine.sample(delay + MIN_PRESS_MS + 54);
      expect(button(engine, 'lt')).toBe(0);
      expect(button(engine, 'y')).toBe(0);
    });

    it('holds the second button for the shortest press', () => {
      const engine = combo();
      engine.press('KeyQ', 0);
      engine.release('KeyQ', 10);
      engine.sample(delay);
      engine.sample(delay + MIN_PRESS_MS - 1);
      expect(button(engine, 'y')).toBe(1);
      engine.sample(delay + MIN_PRESS_MS);
      expect(button(engine, 'y')).toBe(0);
    });

    it('gives a wheel notch combo a full pulse after the delay', () => {
      const engine = combo();
      engine.pulse('WheelUp', 0);
      engine.sample(0);
      expect(button(engine, 'lb')).toBe(1);
      expect(button(engine, 'a')).toBe(0);
      engine.sample(delay + WHEEL_PULSE_MS - 1);
      expect(button(engine, 'lb')).toBe(1);
      expect(button(engine, 'a')).toBe(1);
      engine.sample(delay + WHEEL_PULSE_MS);
      expect(button(engine, 'lb')).toBe(0);
      expect(button(engine, 'a')).toBe(0);
    });

    it('presses everything together when the delay is off', () => {
      const engine = combo(0);
      engine.press('KeyQ', 0);
      engine.sample(0);
      expect(button(engine, 'lt')).toBe(1);
      expect(button(engine, 'y')).toBe(1);
    });

    it('does not delay a key bound only to triggers, bumpers or actions', () => {
      const engine = new InputEngine(
        preset({ bindings: { lt: ['KeyQ'], rb: ['KeyQ'], precision: ['KeyQ'], a: ['Space'] } }),
      );
      engine.press('KeyQ', 0);
      engine.press('Space', 0);
      engine.sample(0);
      expect(button(engine, 'rb')).toBe(1);
      expect(button(engine, 'a')).toBe(1);
    });
  });

  it('lets go of everything on releaseAll', () => {
    const engine = new InputEngine(preset({ toggles: ['a'] }));
    engine.press('Space', 0);
    engine.press('KeyW', 0);
    engine.releaseAll();
    engine.sample(10);
    expect(button(engine, 'a')).toBe(0);
    expect(engine.state.axes[1]).toBe(0);
  });

  it('adds mouse movement to the chosen stick', () => {
    const engine = new InputEngine(
      preset({
        mouse: { ...DEFAULT_MOUSE, target: 'right', smoothing: 0, antiDeadzone: 0, curve: 1 },
      }),
    );
    engine.sample(0);
    engine.moveMouse(10, 0, 5);
    engine.sample(10);
    expect(engine.state.axes[2]).toBeGreaterThan(0);
    expect(engine.state.axes[0]).toBe(0);
  });
});
