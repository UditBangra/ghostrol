import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/shared/settings';

describe('sanitizeSettings', () => {
  it('fills in defaults for missing or broken data', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ fire: 'yes', flame: 7 })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps the flame color, and treats anything unknown as ember', () => {
    expect(sanitizeSettings({ flame: 'ghost' }).flame).toBe('ghost');
    expect(sanitizeSettings({ flame: 'purple' }).flame).toBe('ember');
  });

  it('reads settings saved before flame colors existed', () => {
    const old = sanitizeSettings({ fire: false, hud: 'sticks' });
    expect(old.fire).toBe(false);
    expect(old.flame).toBe('ember');
  });
});
