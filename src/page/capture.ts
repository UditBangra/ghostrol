// Keyboard and mouse capture for the virtual controller.
//
// Listeners are added on window in the capture phase before the site's own scripts run,
// so a bound key is handled here first and never reaches the site. Unbound keys pass
// through untouched. The mouse is only read while it is captured with Pointer Lock.
// Every way of losing focus releases all inputs, so nothing gets stuck down.
//
// Exclusive mode is for games with their own mouse and keyboard support when the user
// picked the virtual controller anyway. In full screen, xCloud forwards every key and
// pointer event it sees to the game, and the game switches to mouse and keyboard. So in
// exclusive mode the site sees no key or pointer input at all.

import type { InputEngine } from '../core/engine';
import { mouseButtonCode, wheelCodes, type InputCode } from '../core/inputs';
import { OVERLAY_TAG } from './dom';

export interface CaptureOptions {
  /** Emulation is on and a game is being played. */
  active: boolean;
  rawMouse: boolean;
  /** The preset uses the mouse at all, so capturing it is useful. */
  wantsMouse: boolean;
  /**
   * The user chose the virtual controller in a game with its own mouse and keyboard
   * support. Hide all key and pointer input from the site, and treat its own pointer
   * lock requests as ours.
   */
  exclusive: boolean;
}

/** xCloud reads the mouse through these, not through mouse events. */
const POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup'] as const;

export class InputCapture {
  private engine: InputEngine | null = null;
  private options: CaptureOptions = {
    active: false,
    rawMouse: true,
    wantsMouse: false,
    exclusive: false,
  };
  private captured = false;
  private requesting = false;
  private suspended = false;

  /** Capture state changed. */
  onChange: () => void = () => {};
  /** The site asked for the mouse itself, which means its own mouse and keyboard mode. */
  onSiteLock: () => void = () => {};
  /**
   * Sees every key outside text fields first, even when emulation is off, so shortcuts
   * work in every mode. Returns true when it used the key.
   */
  keyFilter: (event: KeyboardEvent) => boolean = () => false;
  /** A bound key or mouse button went down or up, for the input display. */
  onInput: (code: InputCode, down: boolean) => void = () => {};
  /** Everything was let go at once. */
  onReset: () => void = () => {};
  /** The game picture was clicked, but the preset has no use for the mouse. */
  onMouselessClick: () => void = () => {};

  install(): void {
    const opts = { capture: true } as const;
    window.addEventListener('keydown', this.onKeyDown, opts);
    window.addEventListener('keyup', this.onKeyUp, opts);
    window.addEventListener('mousedown', this.onMouseDown, opts);
    window.addEventListener('mouseup', this.onMouseUp, opts);
    window.addEventListener('mousemove', this.onMouseMove, opts);
    for (const type of POINTER_EVENTS) window.addEventListener(type, this.onPointer, opts);
    window.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    window.addEventListener('contextmenu', this.onContextMenu, opts);
    window.addEventListener('blur', this.releaseInputs);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    this.watchSiteLocks();
  }

  configure(engine: InputEngine | null, options: CaptureOptions): void {
    const wasActive = this.options.active;
    this.engine = engine;
    this.options = options;
    if (wasActive && !options.active) {
      this.releaseInputs();
      this.release();
    }
  }

  get isCaptured(): boolean {
    return this.captured;
  }

  /**
   * Lets go of the mouse and keeps it free, for example while a panel needs clicks.
   * Keys keep driving the controller.
   */
  suspend(on: boolean): void {
    this.suspended = on;
    if (on) this.release();
  }

  /** Captures the mouse. Must run inside a user gesture such as a click. */
  capture(): void {
    if (!this.options.active || this.captured || this.suspended) return;
    this.requesting = true;
    const target = document.documentElement;
    const done = (promise: unknown) => {
      if (promise instanceof Promise) {
        promise.catch(() => {
          // Raw input is not available everywhere. Fall back to normal movement.
          if (this.options.rawMouse) this.requestLock(target, false);
          else this.requesting = false;
        });
      }
    };
    done(this.requestLock(target, this.options.rawMouse));
  }

  release(): void {
    if (this.captured && document.pointerLockElement) document.exitPointerLock();
  }

  private requestLock(target: Element, raw: boolean): unknown {
    try {
      return raw
        ? (target.requestPointerLock as (o?: object) => unknown).call(target, {
            unadjustedMovement: true,
          })
        : target.requestPointerLock();
    } catch {
      this.requesting = false;
      return undefined;
    }
  }

  /** Wraps requestPointerLock to notice when the site asks for the mouse on its own. */
  private watchSiteLocks(): void {
    const original = Element.prototype.requestPointerLock;
    // The wrapper runs with the element as this, so the capture object needs its own name.
    // oxlint-disable-next-line typescript/no-this-alias
    const self = this;
    Element.prototype.requestPointerLock = function (this: Element, ...args: unknown[]) {
      if (!self.requesting && self.options.active) {
        // The mouse is being kept free on purpose. Say yes and do nothing.
        if (self.suspended) return Promise.resolve() as ReturnType<typeof original>;
        if (self.options.exclusive) self.requesting = true;
        else self.onSiteLock();
      }
      return (original as (...a: unknown[]) => unknown).apply(this, args) as ReturnType<
        typeof original
      >;
    } as typeof original;
  }

  private readonly onLockChange = (): void => {
    const locked = document.pointerLockElement !== null;
    if (locked && this.requesting) {
      this.requesting = false;
      this.captured = true;
      this.onChange();
    } else if (!locked && this.captured) {
      this.captured = false;
      this.releaseInputs();
      this.onChange();
    }
  };

  private readonly onLockError = (): void => {
    this.requesting = false;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isEditable(event)) return;
    if (this.keyFilter(event)) return consume(event);
    const engine = this.engine;
    if (!this.options.active || !engine) return;
    if (event.code === 'Escape') return this.onEscape(event);
    if (engine.isBound(event.code)) {
      consume(event);
      if (!event.repeat && engine.press(event.code, performance.now())) {
        this.onInput(event.code, true);
      }
    } else if (this.options.exclusive) {
      // Hidden from the site, but browser shortcuts such as F11 still work.
      event.stopImmediatePropagation();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (isEditable(event)) return;
    if (this.keyFilter(event)) return consume(event);
    const engine = this.engine;
    if (!this.options.active || !engine) return;
    if (event.code === 'Escape') return this.onEscape(event);
    if (engine.isBound(event.code)) {
      consume(event);
      engine.release(event.code, performance.now());
      this.onInput(event.code, false);
    } else if (this.options.exclusive) {
      event.stopImmediatePropagation();
    }
  };

  /**
   * In full screen xCloud keeps Esc for itself, so the browser no longer lets go of the
   * mouse when Esc is pressed. Let go here so Esc always works.
   */
  private onEscape(event: KeyboardEvent): void {
    if (event.type === 'keydown' && this.captured) this.release();
    if (this.options.exclusive) event.stopImmediatePropagation();
  }

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (!this.options.active) return;
    if (!this.captured) {
      // A click on the game picture captures the mouse. Clicks on the site's own menus pass.
      if (!this.suspended && event.button === 0 && isStreamSurface(event)) {
        if (this.options.wantsMouse) {
          consume(event);
          this.capture();
        } else {
          this.onMouselessClick();
        }
      }
      return;
    }
    consume(event);
    const code = mouseButtonCode(event.button);
    if (this.engine?.press(code, performance.now())) this.onInput(code, true);
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (!this.captured) return;
    consume(event);
    const code = mouseButtonCode(event.button);
    if (this.engine?.release(code, performance.now())) this.onInput(code, false);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.captured || !this.engine) return;
    event.stopImmediatePropagation();
    this.engine.moveMouse(event.movementX, event.movementY, performance.now());
  };

  /**
   * Pointer events go to the site as mouse input in full screen. Hide them while the
   * mouse is ours, and always in exclusive mode. Not cancelled, so clicks still happen.
   */
  private readonly onPointer = (event: Event): void => {
    if (this.options.active && (this.captured || this.options.exclusive)) {
      event.stopImmediatePropagation();
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.options.active) return;
    if (!this.captured || !this.engine) {
      // Scrolling still works; the site just does not hear about it.
      if (this.options.exclusive) event.stopImmediatePropagation();
      return;
    }
    consume(event);
    const now = performance.now();
    for (const code of wheelCodes(event.deltaX, event.deltaY)) {
      if (this.engine.pulse(code, now)) {
        this.onInput(code, true);
        this.onInput(code, false);
      }
    }
  };

  private readonly onContextMenu = (event: Event): void => {
    if (this.captured) event.preventDefault();
  };

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.releaseInputs();
  };

  private readonly releaseInputs = (): void => {
    this.engine?.releaseAll();
    this.onReset();
  };
}

function consume(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function isEditable(event: Event): boolean {
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** True when the click landed on the game picture rather than the site's controls or ours. */
function isStreamSurface(event: MouseEvent): boolean {
  const target = event.composedPath()[0];
  if (target instanceof HTMLVideoElement) return true;
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      `button, a, input, select, textarea, [role="button"], [role="menu"], [role="dialog"], ${OVERLAY_TAG}`,
    )
  ) {
    return false;
  }
  // xCloud draws transparent layers over the video. Look under the click for it.
  return document
    .elementsFromPoint(event.clientX, event.clientY)
    .some((el) => el instanceof HTMLVideoElement);
}
