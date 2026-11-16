// Physical inputs a user can bind. Keyboard keys use KeyboardEvent.code, which names the
// physical key position, so a layout works the same on QWERTY, AZERTY and QWERTZ boards.

export type InputCode = string;

export const MOUSE_BUTTON_CODES = ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'] as const;
export const WHEEL_CODES = ['WheelUp', 'WheelDown', 'WheelLeft', 'WheelRight'] as const;

/** Escape always releases the mouse (a browser rule), so it cannot be bound. */
export const RESERVED_CODES: ReadonlySet<string> = new Set(['Escape']);

const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,30}$/;

export function isInputCode(value: unknown): value is InputCode {
  return typeof value === 'string' && CODE_PATTERN.test(value) && !RESERVED_CODES.has(value);
}

export function mouseButtonCode(button: number): InputCode {
  return `Mouse${button}`;
}

export function isMouseCode(code: InputCode): boolean {
  return code.startsWith('Mouse') || code.startsWith('Wheel');
}

export function isWheelCode(code: InputCode): boolean {
  return code.startsWith('Wheel');
}

/** Converts a wheel event into the codes for each direction it moved. */
export function wheelCodes(deltaX: number, deltaY: number): InputCode[] {
  const codes: InputCode[] = [];
  if (deltaY < 0) codes.push('WheelUp');
  else if (deltaY > 0) codes.push('WheelDown');
  if (deltaX < 0) codes.push('WheelLeft');
  else if (deltaX > 0) codes.push('WheelRight');
  return codes;
}

const NAMED: Readonly<Record<string, string>> = {
  Mouse0: 'Left click',
  Mouse1: 'Middle click',
  Mouse2: 'Right click',
  Mouse3: 'Mouse back',
  Mouse4: 'Mouse forward',
  WheelUp: 'Scroll up',
  WheelDown: 'Scroll down',
  WheelLeft: 'Scroll left',
  WheelRight: 'Scroll right',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  CapsLock: 'Caps',
  ShiftLeft: 'Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Right Alt',
  MetaLeft: 'Win',
  MetaRight: 'Right Win',
  ContextMenu: 'Menu key',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Insert: 'Ins',
  Delete: 'Del',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
};

/** A layout map from navigator.keyboard.getLayoutMap(), when the browser provides one. */
export type LayoutMap = ReadonlyMap<string, string>;

/**
 * Human label for an input code. Printable keys use the user's own layout when known,
 * so an AZERTY user sees "Z" for the key a QWERTY user calls "W".
 */
export function inputLabel(code: InputCode, layout?: LayoutMap): string {
  const named = NAMED[code];
  if (named) return named;
  const fromLayout = layout?.get(code);
  if (fromLayout && fromLayout.trim()) return fromLayout.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** Short form for tight spaces such as keycaps on the controller diagram. */
export function inputShortLabel(code: InputCode, layout?: LayoutMap): string {
  switch (code) {
    case 'Mouse0':
      return 'LMB';
    case 'Mouse1':
      return 'MMB';
    case 'Mouse2':
      return 'RMB';
    case 'Mouse3':
      return 'M4';
    case 'Mouse4':
      return 'M5';
    case 'WheelUp':
      return 'Wheel ↑';
    case 'WheelDown':
      return 'Wheel ↓';
    case 'WheelLeft':
      return 'Wheel ←';
    case 'WheelRight':
      return 'Wheel →';
    case 'ShiftRight':
      return 'R Shift';
    case 'ControlRight':
      return 'R Ctrl';
    case 'AltRight':
      return 'R Alt';
    case 'Backspace':
      return 'Bksp';
    default:
      return inputLabel(code, layout);
  }
}
