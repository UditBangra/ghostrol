import { describe, expect, it } from 'vitest';
import { matchesShortcut, parseShortcut, type KeyLike } from '../src/core/shortcuts';

const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  code,
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('parseShortcut', () => {
  it('reads Windows and Linux shortcut text', () => {
    expect(parseShortcut('Alt+K')).toEqual({
      code: 'KeyK',
      alt: true,
      ctrl: false,
      shift: false,
      meta: false,
    });
    expect(parseShortcut('Ctrl+Shift+Period')?.code).toBe('Period');
    expect(parseShortcut('Alt+.')?.code).toBe('Period');
    expect(parseShortcut('Alt+7')?.code).toBe('Digit7');
    expect(parseShortcut('Ctrl+F9')?.code).toBe('F9');
  });

  it('reads Mac symbols', () => {
    const s = parseShortcut('⌥⇧K');
    expect(s).toMatchObject({ code: 'KeyK', alt: true, shift: true, ctrl: false, meta: false });
    expect(parseShortcut('⌘Comma')).toMatchObject({ code: 'Comma', meta: true });
  });

  it('returns null for empty or unreadable shortcuts', () => {
    expect(parseShortcut('')).toBeNull();
    expect(parseShortcut('K')).toBeNull();
    expect(parseShortcut('Shift+K')).toBeNull();
    expect(parseShortcut('Alt+MediaPlayPause')).toBeNull();
    expect(parseShortcut('Hyper+K')).toBeNull();
  });
});

describe('matchesShortcut', () => {
  it('needs the exact modifiers', () => {
    const s = parseShortcut('Alt+K');
    expect(matchesShortcut(s, key('KeyK', { altKey: true }))).toBe(true);
    expect(matchesShortcut(s, key('KeyK'))).toBe(false);
    expect(matchesShortcut(s, key('KeyK', { altKey: true, shiftKey: true }))).toBe(false);
    expect(matchesShortcut(null, key('KeyK', { altKey: true }))).toBe(false);
  });
});
