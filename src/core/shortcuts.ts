// Reads Chrome's shortcut text ("Alt+K", "Ctrl+Shift+Period", "⌥⇧K") into something a
// keydown event can be matched against. The page uses it to catch the extension's
// shortcuts itself, because in full screen the stream can take keys before Chrome does.

export interface Shortcut {
  /** KeyboardEvent.code of the main key. */
  code: string;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

export interface KeyLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const NAMED_KEYS: Readonly<Record<string, string>> = {
  Period: 'Period',
  '.': 'Period',
  Comma: 'Comma',
  ',': 'Comma',
  Space: 'Space',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Ins: 'Insert',
  Delete: 'Delete',
  Del: 'Delete',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
  '←': 'ArrowLeft',
  '→': 'ArrowRight',
};

const MAC_SYMBOLS: Readonly<Record<string, keyof Omit<Shortcut, 'code'>>> = {
  '⌥': 'alt',
  '⌃': 'ctrl',
  '⇧': 'shift',
  '⌘': 'meta',
};

function keyCode(token: string): string | null {
  if (/^[A-Za-z]$/.test(token)) return `Key${token.toUpperCase()}`;
  if (/^[0-9]$/.test(token)) return `Digit${token}`;
  if (/^F([1-9]|1[0-2])$/.test(token)) return token;
  return NAMED_KEYS[token] ?? null;
}

export function parseShortcut(text: string): Shortcut | null {
  const shortcut: Shortcut = { code: '', alt: false, ctrl: false, shift: false, meta: false };
  let rest = text.trim();
  // Mac style puts modifier symbols in front with no separator.
  while (rest && MAC_SYMBOLS[rest[0]!]) {
    shortcut[MAC_SYMBOLS[rest[0]!]!] = true;
    rest = rest.slice(1);
  }
  const parts = rest.split('+').map((p) => p.trim());
  // A shortcut on the plus key itself splits into empty parts. Not supported.
  if (parts.some((p) => !p)) return null;
  const key = parts.pop();
  for (const part of parts) {
    const name = part.toLowerCase();
    if (name === 'alt' || name === 'option') shortcut.alt = true;
    else if (name === 'ctrl' || name === 'control' || name === 'macctrl') shortcut.ctrl = true;
    else if (name === 'shift') shortcut.shift = true;
    else if (name === 'command' || name === 'cmd' || name === 'search') shortcut.meta = true;
    else return null;
  }
  const code = key ? keyCode(key) : null;
  if (!code) return null;
  // Chrome requires a modifier other than Shift, so a bare key here is a misread.
  if (!shortcut.alt && !shortcut.ctrl && !shortcut.meta) return null;
  shortcut.code = code;
  return shortcut;
}

export function matchesShortcut(shortcut: Shortcut | null, event: KeyLike): boolean {
  return (
    !!shortcut &&
    event.code === shortcut.code &&
    event.altKey === shortcut.alt &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.metaKey === shortcut.meta
  );
}
