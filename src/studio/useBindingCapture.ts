// Listens for the next key press, mouse click or wheel turn, for adding a binding.

import { useEffect, useRef, useState } from 'preact/hooks';
import { isInputCode, mouseButtonCode, wheelCodes, type InputCode } from '../core/inputs';
import type { Target } from '../core/targets';

export function useBindingCapture(onCapture: (target: Target, code: InputCode) => void) {
  const [listening, setListening] = useState<Target | null>(null);
  const callback = useRef(onCapture);
  callback.current = onCapture;

  useEffect(() => {
    if (!listening) return;
    const done = (code?: InputCode) => {
      if (code && isInputCode(code)) callback.current(listening, code);
      setListening(null);
    };
    const key = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      done(e.code === 'Escape' ? undefined : e.code);
    };
    const mouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      done(mouseButtonCode(e.button));
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      done(wheelCodes(e.deltaX, e.deltaY)[0]);
    };
    const menu = (e: Event) => e.preventDefault();
    // Wait a tick so the click that started listening is not captured as a binding.
    const timer = setTimeout(() => {
      window.addEventListener('keydown', key, true);
      window.addEventListener('mousedown', mouse, true);
      window.addEventListener('wheel', wheel, { capture: true, passive: false });
      window.addEventListener('contextmenu', menu, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('mousedown', mouse, true);
      window.removeEventListener('wheel', wheel, true);
      window.removeEventListener('contextmenu', menu, true);
    };
  }, [listening]);

  return { listening, listen: setListening, cancel: () => setListening(null) };
}
