import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { LayoutMap } from '../core/inputs';
import { loadState, onStateChanged, type StoredState } from '../shared/storage';

/** Stored state, kept current when anything changes it, including other tabs. */
export function useStoredState(): StoredState | null {
  const [state, setState] = useState<StoredState | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => loadState().then((s) => alive && setState(s));
    refresh();
    const stop = onStateChanged(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, []);
  return state;
}

interface KeyboardWithLayout {
  getLayoutMap?: () => Promise<LayoutMap>;
}

/** The user's keyboard layout, so keys show the letters printed on their keyboard. */
export function useLayoutMap(): LayoutMap | undefined {
  const [layout, setLayout] = useState<LayoutMap>();
  useEffect(() => {
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
    keyboard
      ?.getLayoutMap?.()
      .then(setLayout)
      .catch(() => undefined);
  }, []);
  return layout;
}

/** Tracks which physical keys and mouse buttons are down, for live keycap feedback. */
export function usePressedInputs(enabled: boolean): ReadonlySet<string> {
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!enabled) return;
    const set = new Set<string>();
    const commit = () => setPressed(new Set(set));
    const down = (e: KeyboardEvent) => {
      if (!set.has(e.code)) {
        set.add(e.code);
        commit();
      }
    };
    const up = (e: KeyboardEvent) => {
      set.delete(e.code);
      commit();
    };
    const clear = () => {
      set.clear();
      commit();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [enabled]);
  return pressed;
}

/**
 * A highlight that slides to the chosen item instead of jumping there. Returns a ref for
 * the container, which must be positioned. The container gets --thumb-x, --thumb-y,
 * --thumb-w and --thumb-h for the chosen item (found with `selector`), the class
 * has-thumb while one is chosen, and thumb-ready from the frame after the first
 * placement, so the highlight only moves when the choice changes, never on arrival.
 */
export function useThumb<T extends HTMLElement>(selector: string, key: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const place = () => {
      const item = box.querySelector<HTMLElement>(selector);
      box.classList.toggle('has-thumb', !!item);
      if (!item) return;
      box.style.setProperty('--thumb-x', `${item.offsetLeft}px`);
      box.style.setProperty('--thumb-y', `${item.offsetTop}px`);
      box.style.setProperty('--thumb-w', `${item.offsetWidth}px`);
      box.style.setProperty('--thumb-h', `${item.offsetHeight}px`);
    };
    place();
    // Sizes change when fonts arrive or the window is resized.
    const observer = new ResizeObserver(place);
    observer.observe(box);
    for (const child of box.children) observer.observe(child);
    const frame = requestAnimationFrame(() => box.classList.add('thumb-ready'));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [selector, key]);
  return ref;
}
