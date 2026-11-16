// The controls panel: every key of the current preset with its controller button and
// what it does, a preset switcher and mouse speed. Opens over the game, including in
// full screen.
//
// Held open (peek), it is only a picture and the game keeps the mouse. Opened with a
// tap, it takes clicks and the mouse is let go until it closes.

import type { LayoutMap } from '../core/inputs';
import type { Preset } from '../core/preset';
import { TARGET_GROUPS, TARGET_NAMES } from '../core/targets';
import type { PresetChoice, Shortcuts } from '../shared/messages';
import { glyph, h, keycap, mark } from './dom';

const SPEED_STEP = 5;

export interface PanelData {
  title: string;
  /** Why this preset is in use, in words. */
  reason: string;
  preset: Preset;
  layout?: LayoutMap | undefined;
  choices: PresetChoice[];
  /** The preset picked for this game, or null when it is chosen automatically. */
  pickedId: string | null;
  automaticName: string;
  shortcuts: Shortcuts;
  brand: string;
}

export class ControlsPanel {
  readonly el = h('div', 'scrim');
  private data: PanelData | null = null;
  private peek = false;
  private speed = 0;
  private speedValue: HTMLElement | null = null;

  /** A preset was picked. Null means automatic. */
  onPick: (presetId: string | null) => void = () => {};
  /** Mouse speed changed with the buttons. */
  onSpeed: (value: number) => void = () => {};
  /** The player asked to go back to the game. */
  onBack: () => void = () => {};

  constructor() {
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Controls');
    // A click on the dimmed game around the panel also goes back.
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.onBack();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  get isPeek(): boolean {
    return this.isOpen && this.peek;
  }

  open(data: PanelData, peek: boolean): void {
    this.peek = peek;
    this.data = data;
    this.speed = data.preset.mouse.sensitivity;
    this.render();
    this.el.hidden = false;
  }

  /** New data while open, such as after switching presets. */
  update(data: PanelData): void {
    if (!this.isOpen) return;
    const samePreset = this.data?.preset.id === data.preset.id;
    this.data = data;
    // Keep the speed being edited until the change comes back from storage.
    if (!samePreset) this.speed = data.preset.mouse.sensitivity;
    this.render();
  }

  setPeek(peek: boolean): void {
    if (this.peek === peek) return;
    this.peek = peek;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
    this.el.replaceChildren();
    this.data = null;
  }

  private render(): void {
    const data = this.data;
    if (!data) return;
    this.el.classList.toggle('peek', this.peek);
    const head = h(
      'div',
      'panel-head',
      mark('mark big'),
      h(
        'div',
        'panel-title',
        h('h2', '', data.title),
        h('p', '', `${data.preset.name}. ${data.reason}.`),
      ),
    );
    if (this.peek) {
      head.append(h('span', 'peek-note', 'Let go to close'));
    } else {
      const back = h('button', 'back', 'Back to game');
      back.type = 'button';
      back.addEventListener('click', () => this.onBack());
      head.append(back);
    }
    const panel = h(
      'div',
      'panel',
      head,
      h('div', 'panel-body', this.keyList(data), this.side(data)),
    );
    this.el.replaceChildren(panel);
  }

  private keyList({ preset, layout }: PanelData): HTMLElement {
    const groups: { el: HTMLElement; size: number }[] = [];
    for (const group of TARGET_GROUPS) {
      const rows = group.targets
        .filter((target) => preset.bindings[target]?.length)
        .map((target) =>
          h(
            'div',
            'row',
            h(
              'span',
              'codes',
              ...(preset.bindings[target] ?? []).map((code) => keycap(code, layout)),
            ),
            glyph(target),
            h('span', 'what', preset.labels[target] ?? TARGET_NAMES[target]),
          ),
        );
      if (!rows.length) continue;
      groups.push({
        el: h('section', 'group', h('h3', '', group.name), ...rows),
        size: rows.length + 1,
      });
    }
    // Two columns of about equal height, groups kept whole and in order.
    const total = groups.reduce((sum, g) => sum + g.size, 0);
    let split = 0;
    let best = Infinity;
    for (let i = 0, filled = 0; i <= groups.length; filled += groups[i]?.size ?? 0, i++) {
      const taller = Math.max(filled, total - filled);
      if (taller < best) [best, split] = [taller, i];
    }
    const left = h('div', 'col', ...groups.slice(0, split).map((g) => g.el));
    const right = h('div', 'col', ...groups.slice(split).map((g) => g.el));
    const keys = h('div', 'keys', h('div', 'cols', left, right));
    if (preset.notes) keys.append(h('p', 'notes', preset.notes));
    return keys;
  }

  private side(data: PanelData): HTMLElement {
    const side = h('div', 'side');

    const choices = h('div', 'choices');
    choices.setAttribute('role', 'radiogroup');
    choices.setAttribute('aria-label', 'Preset');
    const option = (id: string | null, name: string) => {
      const button = h('button', 'choice', h('span', '', name));
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(data.pickedId === id));
      button.disabled = this.peek;
      button.addEventListener('click', () => {
        if (data.pickedId === id) return;
        for (const b of choices.children) b.setAttribute('aria-checked', 'false');
        button.setAttribute('aria-checked', 'true');
        this.onPick(id);
      });
      return button;
    };
    choices.append(option(null, `Automatic (${data.automaticName})`));
    for (const choice of data.choices) choices.append(option(choice.id, choice.name));
    side.append(h('section', '', h('h3', '', 'Preset'), choices));

    const { mouse } = data.preset;
    if (mouse.target !== 'none') {
      this.speedValue = h('span', 'speed-value', String(this.speed));
      const step = (delta: number, label: string, text: string) => {
        const button = h('button', 'step', text);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.disabled = this.peek;
        button.addEventListener('click', () => {
          this.speed = Math.min(100, Math.max(1, this.speed + delta));
          if (this.speedValue) this.speedValue.textContent = String(this.speed);
          this.onSpeed(this.speed);
        });
        return button;
      };
      const section = h(
        'section',
        '',
        h('h3', '', mouse.mode === 'wheel' ? 'Steering speed' : 'Mouse speed'),
        h(
          'div',
          'stepper',
          step(-SPEED_STEP, 'Slower', '−'),
          this.speedValue,
          step(SPEED_STEP, 'Faster', '+'),
        ),
      );
      if (!data.preset.id.startsWith('user:')) {
        section.append(
          h('small', '', 'Changing it saves your own copy of this preset for this game.'),
        );
      }
      side.append(section);
    }

    const { shortcuts, brand } = data;
    const hint = (keys: string, text: string) =>
      keys ? h('div', '', ...keys.split('+').map((k) => h('span', 'cap', k)), text) : null;
    side.append(
      h(
        'section',
        '',
        h('h3', '', 'Shortcuts'),
        h(
          'div',
          'hints',
          hint(shortcuts.controls, 'Hold to peek, tap to keep open'),
          hint(shortcuts.nextPreset, 'Next preset'),
          hint(shortcuts.toggle, `Turn ${brand} off`),
          hint('Esc', this.peek ? 'Frees the mouse' : 'Closes this panel'),
        ),
      ),
    );
    return side;
  }
}
