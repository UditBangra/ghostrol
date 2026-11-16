import { describe, expect, it } from 'vitest';
import { BRAND } from '../src/shared/brand';
import { describeBrowser, problemReportUrl } from '../src/shared/report';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const EDGE_WIN = `${CHROME_WIN} Edg/142.0.0.0`;
const CHROME_OS =
  'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

describe('describeBrowser', () => {
  it('names Chrome and the system', () => {
    expect(describeBrowser(CHROME_WIN)).toBe('Chrome 142 on Windows');
  });
  it('tells Edge apart from Chrome', () => {
    expect(describeBrowser(EDGE_WIN)).toBe('Edge 142 on Windows');
  });
  it('recognizes ChromeOS before Linux', () => {
    expect(describeBrowser(CHROME_OS)).toBe('Chrome 142 on ChromeOS');
  });
  it('falls back without guessing', () => {
    expect(describeBrowser('something else')).toBe('Unknown browser');
  });
});

describe('problemReportUrl', () => {
  it('opens the bug form on the repository with the details filled in', () => {
    const url = new URL(
      problemReportUrl({
        version: '0.1.0',
        userAgent: CHROME_WIN,
        game: 'Forza Horizon 6',
        preset: 'Forza Horizon',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(`${BRAND.repoUrl}/issues/new`);
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('title')).toBe('Forza Horizon 6: ');
    expect(url.searchParams.get('game')).toBe('Forza Horizon 6');
    expect(url.searchParams.get('preset')).toBe('Forza Horizon');
    expect(url.searchParams.get('version')).toBe('0.1.0');
    expect(url.searchParams.get('browser')).toBe('Chrome 142 on Windows');
  });
  it('leaves the game out when none is open', () => {
    const url = new URL(problemReportUrl({ version: '0.1.0', userAgent: CHROME_WIN }));
    expect(url.searchParams.has('game')).toBe(false);
    expect(url.searchParams.get('title')).toBe('');
  });
});
