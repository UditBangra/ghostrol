// Everything a preset can bind an input to: controller buttons, stick directions,
// and a few actions that change how other inputs behave.

/** Buttons in W3C "standard" gamepad order. The index of each name is its button index. */
export const BUTTONS = [
  'a',
  'b',
  'x',
  'y',
  'lb',
  'rb',
  'lt',
  'rt',
  'view',
  'menu',
  'ls',
  'rs',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight',
  'guide',
] as const;
export type Button = (typeof BUTTONS)[number];

export const STICK_DIRECTIONS = [
  'lsUp',
  'lsDown',
  'lsLeft',
  'lsRight',
  'rsUp',
  'rsDown',
  'rsLeft',
  'rsRight',
] as const;
export type StickDirection = (typeof STICK_DIRECTIONS)[number];

/** Actions that are not controller outputs. */
export const ACTIONS = ['precision', 'recenter'] as const;
export type Action = (typeof ACTIONS)[number];

export type Target = Button | StickDirection | Action;

export const TARGETS: readonly Target[] = [...BUTTONS, ...STICK_DIRECTIONS, ...ACTIONS];

export const BUTTON_COUNT = BUTTONS.length;

export const TRIGGERS: readonly Button[] = ['lt', 'rt'];

const TARGET_SET = new Set<string>(TARGETS);
export function isTarget(value: unknown): value is Target {
  return typeof value === 'string' && TARGET_SET.has(value);
}

export const BUTTON_INDEX: Readonly<Record<Button, number>> = Object.fromEntries(
  BUTTONS.map((name, i) => [name, i]),
) as Record<Button, number>;

export type Stick = 'left' | 'right';

/** How targets are grouped in key lists, in reading order. */
export interface TargetGroup {
  name: string;
  targets: Target[];
}

export const TARGET_GROUPS: readonly TargetGroup[] = [
  { name: 'Face buttons', targets: ['a', 'b', 'x', 'y'] },
  { name: 'Triggers and bumpers', targets: ['rt', 'lt', 'rb', 'lb'] },
  { name: 'Left stick', targets: ['lsUp', 'lsDown', 'lsLeft', 'lsRight', 'ls'] },
  { name: 'Right stick', targets: ['rsUp', 'rsDown', 'rsLeft', 'rsRight', 'rs'] },
  { name: 'D-pad', targets: ['dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight'] },
  { name: 'System', targets: ['menu', 'view', 'guide'] },
  { name: 'Extras', targets: ['precision', 'recenter'] },
];

/** Display names shown in the interface. */
export const TARGET_NAMES: Readonly<Record<Target, string>> = {
  a: 'A',
  b: 'B',
  x: 'X',
  y: 'Y',
  lb: 'Left bumper',
  rb: 'Right bumper',
  lt: 'Left trigger',
  rt: 'Right trigger',
  view: 'View',
  menu: 'Menu',
  ls: 'Left stick click',
  rs: 'Right stick click',
  dpadUp: 'D-pad up',
  dpadDown: 'D-pad down',
  dpadLeft: 'D-pad left',
  dpadRight: 'D-pad right',
  guide: 'Xbox button',
  lsUp: 'Left stick up',
  lsDown: 'Left stick down',
  lsLeft: 'Left stick left',
  lsRight: 'Left stick right',
  rsUp: 'Right stick up',
  rsDown: 'Right stick down',
  rsLeft: 'Right stick left',
  rsRight: 'Right stick right',
  precision: 'Precision hold',
  recenter: 'Center wheel',
};

/** Short glyph text used on the controller diagram and in compact lists. */
export const TARGET_GLYPHS: Readonly<Record<Target, string>> = {
  a: 'A',
  b: 'B',
  x: 'X',
  y: 'Y',
  lb: 'LB',
  rb: 'RB',
  lt: 'LT',
  rt: 'RT',
  view: 'View',
  menu: 'Menu',
  ls: 'LS',
  rs: 'RS',
  dpadUp: 'D↑',
  dpadDown: 'D↓',
  dpadLeft: 'D←',
  dpadRight: 'D→',
  guide: 'Xbox',
  lsUp: 'L↑',
  lsDown: 'L↓',
  lsLeft: 'L←',
  lsRight: 'L→',
  rsUp: 'R↑',
  rsDown: 'R↓',
  rsLeft: 'R←',
  rsRight: 'R→',
  precision: 'Fine',
  recenter: 'Center',
};
