// Smooth wheel scrolling for the Studio, with Lenis (MIT, bundled, no network).
//
// Lenis eases the page toward where the wheel sends it. Keys, the scroll bar and touch
// keep the browser's own scrolling. It turns itself off when the system asks for less
// motion. Lists that scroll on their own, such as the preset list and the game picker,
// keep their own wheel scrolling.

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let lenis: Lenis | null = null;

export function startSmoothScroll(): void {
  lenis = new Lenis({
    autoRaf: true,
    // How much of the remaining distance each frame covers. Higher is snappier.
    lerp: 0.12,
    allowNestedScroll: true,
    // Lenis does not check whether someone else already used a wheel turn, so tell it.
    // Binding the wheel to a control uses it (and cancels it), and so does Try it while
    // it holds the mouse. Neither should scroll the page.
    virtualScroll: ({ event }) => !event.defaultPrevented && !document.pointerLockElement,
  });
}

/** Jumps to the top, for a new section. */
export function scrollToTop(): void {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

/** Glides an element to the middle of the window. */
export function scrollToCenter(el: HTMLElement): void {
  if (!lenis) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  lenis.scrollTo(el, { offset: -(window.innerHeight - el.offsetHeight) / 2 });
}
