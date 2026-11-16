// A test area that runs the same engine as the game, so a preset can be tried and tuned
// without launching anything. Click it to capture the mouse; Esc lets go.

import { useEffect, useRef, useState } from 'preact/hooks';
import { InputEngine, type ControllerState } from '../core/engine';
import { mouseButtonCode, wheelCodes } from '../core/inputs';
import type { Preset } from '../core/preset';
import { ControllerView } from '../ui/ControllerView';

export function TryIt({ preset }: { preset: Preset }) {
  const area = useRef<HTMLDivElement>(null);
  const engine = useRef<InputEngine | null>(null);
  const [state, setState] = useState<ControllerState | null>(null);
  const [captured, setCaptured] = useState(false);
  const [focused, setFocused] = useState(false);

  if (!engine.current) engine.current = new InputEngine(preset);
  useEffect(() => engine.current?.setPreset(preset), [preset]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const live = () => document.pointerLockElement === el || document.activeElement === el;
    const now = () => performance.now();
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (!live() || !engine.current?.isBound(e.code)) return;
      e.preventDefault();
      if (down && !e.repeat) engine.current.press(e.code, now());
      if (!down) engine.current.release(e.code, now());
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);
    const mouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      e.preventDefault();
      engine.current?.press(mouseButtonCode(e.button), now());
    };
    const mouseUp = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      engine.current?.release(mouseButtonCode(e.button), now());
    };
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement === el)
        engine.current?.moveMouse(e.movementX, e.movementY, now());
    };
    const wheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== el) return;
      e.preventDefault();
      for (const code of wheelCodes(e.deltaX, e.deltaY)) engine.current?.pulse(code, now());
    };
    const lockChange = () => {
      const locked = document.pointerLockElement === el;
      setCaptured(locked);
      if (!locked) engine.current?.releaseAll();
    };
    const blur = () => engine.current?.releaseAll();

    let frame = 0;
    const tick = () => {
      const e = engine.current;
      // Only re-render when the controller state actually changed.
      if (e?.sample(now()))
        setState({ axes: e.state.axes.slice(), buttons: e.state.buttons.slice() });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('mousemove', move);
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', blur);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', blur);
      document.removeEventListener('pointerlockchange', lockChange);
    };
  }, []);

  const capture = () => {
    const el = area.current;
    if (!el || document.pointerLockElement === el) return;
    const request = (el.requestPointerLock as (o?: object) => Promise<void> | void).call(el, {
      unadjustedMovement: true,
    });
    if (request instanceof Promise) request.catch(() => el.requestPointerLock());
  };

  return (
    <div
      ref={area}
      class={`tryit${captured ? ' captured' : ''}${focused ? ' focused' : ''}`}
      tabIndex={0}
      onClick={capture}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        engine.current?.releaseAll();
      }}
      aria-label="Test area. Click to capture the mouse, then press keys."
    >
      <ControllerView state={state} />
      <p class="tryit-hint">
        {captured
          ? 'Press keys and move the mouse. Esc lets go.'
          : focused
            ? 'Keys work now. Click to add the mouse.'
            : 'Click here, then press keys and move the mouse.'}
      </p>
    </div>
  );
}
