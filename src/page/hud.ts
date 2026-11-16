// The input display in a bottom corner of the game.
//
// Keys: each key press shows a chip with the key, the controller button it pressed and
// what that does in the game. Chips stay while the key is held and fade out shortly
// after. Sticks: the two sticks, both triggers and the face buttons, drawn every frame.

import type { ControllerState } from '../core/engine';
import type { InputCode, LayoutMap } from '../core/inputs';
import { BUTTON_INDEX, type Target } from '../core/targets';
import type { HudCorner, HudMode } from '../shared/settings';
import { glyph, h, keycap } from './dom';

/**
 * After its key comes up a chip stays LINGER_MS, then fades for FADE_MS: gone 0.8 s
 * after release.
 */
const LINGER_MS = 600;
/** Matches the .chip transition in styles.ts. */
const FADE_MS = 200;
const MAX_CHIPS = 4;
const MAX_GLYPHS = 3;

export interface KeyMeaning {
  targets: readonly Target[];
  label: string;
}

interface Chip {
  el: HTMLElement;
  held: boolean;
  timer: number;
}

export class Hud {
  readonly el = h('div', 'hud');
  private readonly chipList = h('div', 'chips');
  private readonly pad = h('div', 'pad');
  private readonly chips = new Map<InputCode, Chip>();
  private readonly sticks: HTMLElement[] = [];
  private readonly dots: HTMLElement[] = [];
  private readonly triggers: HTMLElement[] = [];
  private mode: HudMode = 'off';
  private source: (() => ControllerState | null) | null = null;
  private frame = 0;
  private drawn = '';

  constructor() {
    this.el.setAttribute('aria-hidden', 'true');
    const left = h('div', 'stick', h('i'));
    const right = h('div', 'stick', h('i'));
    this.sticks.push(left, right);
    const mid = h('div', 'pad-mid');
    for (const name of ['LT', 'RT']) {
      const fill = h('i');
      this.triggers.push(fill);
      mid.append(h('div', 'trig', name, h('span', '', fill)));
    }
    const face = h('div', 'face-dots');
    for (const name of ['a', 'b', 'x', 'y']) {
      const dot = h('i', name);
      this.dots.push(dot);
      face.append(dot);
    }
    mid.append(face);
    this.pad.append(left, mid, right);
    this.el.append(this.chipList, this.pad);
    this.configure('off', 'left', null);
  }

  configure(mode: HudMode, corner: HudCorner, source: (() => ControllerState | null) | null): void {
    this.mode = source ? mode : 'off';
    this.source = source;
    this.el.hidden = this.mode === 'off';
    this.el.classList.toggle('right', corner === 'right');
    this.chipList.hidden = this.mode !== 'keys' && this.mode !== 'both';
    this.pad.hidden = this.mode !== 'sticks' && this.mode !== 'both';
    if (this.chipList.hidden) this.clearChips();
    cancelAnimationFrame(this.frame);
    if (!this.pad.hidden) this.frame = requestAnimationFrame(this.draw);
  }

  get showsKeys(): boolean {
    return !this.chipList.hidden && !this.el.hidden;
  }

  /** A bound key or button went down or up. */
  key(code: InputCode, down: boolean, meaning: KeyMeaning, layout?: LayoutMap): void {
    if (!this.showsKeys) return;
    let chip = this.chips.get(code);
    if (down) {
      if (!chip) {
        chip = { el: this.buildChip(code, meaning, layout), held: false, timer: 0 };
        this.chips.set(code, chip);
      } else {
        chip.el.classList.remove('gone');
      }
      // Newest at the bottom, nearest the corner.
      this.chipList.append(chip.el);
      clearTimeout(chip.timer);
      chip.held = true;
      chip.el.classList.add('held');
      this.trim();
    } else if (chip) {
      chip.held = false;
      chip.el.classList.remove('held');
      this.linger(code, chip);
    }
  }

  /** Everything was let go at once, such as when the window lost focus. */
  reset(): void {
    for (const [code, chip] of this.chips) {
      if (!chip.held) continue;
      chip.held = false;
      chip.el.classList.remove('held');
      this.linger(code, chip);
    }
  }

  private buildChip(code: InputCode, meaning: KeyMeaning, layout?: LayoutMap): HTMLElement {
    const glyphs = meaning.targets.slice(0, MAX_GLYPHS).map(glyph);
    return h(
      'div',
      'chip',
      keycap(code, layout),
      h('span', 'to', '→'),
      ...glyphs,
      h('span', 'what', meaning.label),
    );
  }

  private linger(code: InputCode, chip: Chip): void {
    clearTimeout(chip.timer);
    chip.timer = window.setTimeout(() => {
      chip.el.classList.add('gone');
      chip.timer = window.setTimeout(() => this.drop(code), FADE_MS);
    }, LINGER_MS);
  }

  private drop(code: InputCode): void {
    const chip = this.chips.get(code);
    if (!chip) return;
    clearTimeout(chip.timer);
    chip.el.remove();
    this.chips.delete(code);
  }

  /** Keeps the stack short by removing the oldest chips that are no longer held. */
  private trim(): void {
    for (const [code, chip] of this.chips) {
      if (this.chips.size <= MAX_CHIPS) return;
      if (!chip.held) this.drop(code);
    }
  }

  private clearChips(): void {
    // Deleting from a Map while iterating it is safe.
    for (const code of this.chips.keys()) this.drop(code);
  }

  private readonly draw = (): void => {
    const state = this.source?.();
    if (state) this.paint(state);
    this.frame = requestAnimationFrame(this.draw);
  };

  private paint({ axes, buttons }: ControllerState): void {
    const lt = buttons[BUTTON_INDEX.lt] ?? 0;
    const rt = buttons[BUTTON_INDEX.rt] ?? 0;
    const faces = (['a', 'b', 'x', 'y'] as const).map((n) =>
      (buttons[BUTTON_INDEX[n]] ?? 0) > 0 ? 1 : 0,
    );
    // Skip the DOM entirely on frames where nothing moved.
    const key = `${axes.join()}|${lt}|${rt}|${faces.join('')}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const pairs: [number, number][] = [
      [axes[0] ?? 0, axes[1] ?? 0],
      [axes[2] ?? 0, axes[3] ?? 0],
    ];
    pairs.forEach(([x, y], i) => {
      const ring = this.sticks[i];
      if (!ring) return;
      (ring.firstChild as HTMLElement).style.translate =
        `${(x * 18).toFixed(1)}px ${(y * 18).toFixed(1)}px`;
      ring.classList.toggle('on', x !== 0 || y !== 0);
    });
    this.triggers[0]!.style.scale = `${lt} 1`;
    this.triggers[1]!.style.scale = `${rt} 1`;
    faces.forEach((on, i) => this.dots[i]?.classList.toggle('on', on === 1));
  }
}
