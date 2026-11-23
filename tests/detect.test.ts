import { describe, expect, it } from 'vitest';
import { isPlaying, parseGameUrl, slugToTitle } from '../src/core/detect';
import { normalizeTitle } from '../src/core/titles';

describe('parseGameUrl', () => {
  it('reads a cloud stream on www.xbox.com', () => {
    expect(
      parseGameUrl(
        'https://www.xbox.com/en-US/play/launch/forza-horizon-6-standard-edition/9N431PX143P8',
      ),
    ).toEqual({
      kind: 'stream',
      productId: '9N431PX143P8',
      slug: 'forza-horizon-6-standard-edition',
    });
  });

  it('reads a cloud stream on play.xbox.com, where the ID comes first', () => {
    expect(parseGameUrl('https://play.xbox.com/stream/9n431px143p8/forza-horizon-6')).toEqual({
      kind: 'stream',
      productId: '9N431PX143P8',
      slug: 'forza-horizon-6',
    });
  });

  it('reads a game details page', () => {
    const game = parseGameUrl(
      'https://www.xbox.com/en-GB/play/games/halo-infinite/9PP5G1F0C2B6?x=1',
    );
    expect(game).toMatchObject({ kind: 'details', productId: '9PP5G1F0C2B6' });
    expect(isPlaying(game)).toBe(false);
  });

  it('reads the game and store pages on play.xbox.com', () => {
    for (const url of [
      'https://play.xbox.com/game-hub/9N431PX143P8/forza-horizon-6',
      'https://play.xbox.com/products/9n431px143p8',
    ]) {
      const game = parseGameUrl(url);
      expect(game).toMatchObject({ kind: 'details', productId: '9N431PX143P8' });
      expect(isPlaying(game)).toBe(false);
    }
  });

  it('reads Remote Play on the older site', () => {
    const game = parseGameUrl('https://www.xbox.com/en-US/play/consoles/launch/F4001ABCDEF12345');
    expect(game).toEqual({ kind: 'remote' });
    expect(isPlaying(game)).toBe(true);
  });

  it('reads Remote Play on play.xbox.com, where it is remoteplay and a console ID', () => {
    for (const url of [
      'https://play.xbox.com/remoteplay/F4001ABCDEF12345',
      'https://play.xbox.com/en-US/remoteplay/F4001ABCDEF12345?x=1',
      'https://play.xbox.com/remoteplay/1b2c3d4e-0000-4abc-9def-123456789abc',
    ]) {
      const game = parseGameUrl(url);
      expect(game).toEqual({ kind: 'remote' });
      expect(isPlaying(game)).toBe(true);
    }
  });

  it('does not treat the Remote Play console list as playing', () => {
    expect(parseGameUrl('https://play.xbox.com/remoteplay')).toBeNull();
    expect(parseGameUrl('https://www.xbox.com/en-US/remoteplay')).toBeNull();
  });

  it('ignores other pages and sites', () => {
    expect(parseGameUrl('https://www.xbox.com/en-US/play')).toBeNull();
    expect(parseGameUrl('https://www.xbox.com/en-US/play/gallery/all-games')).toBeNull();
    expect(parseGameUrl('https://example.com/play/launch/a/9N431PX143P8')).toBeNull();
    expect(parseGameUrl('not a url')).toBeNull();
  });
});

describe('titles', () => {
  it('turns slugs into titles', () => {
    expect(slugToTitle('forza-horizon-6-standard-edition')).toBe(
      'Forza Horizon 6 Standard Edition',
    );
    expect(slugToTitle('the-elder-scrolls-v-skyrim')).toBe('The Elder Scrolls V Skyrim');
  });

  it('matches editions of the same game', () => {
    const base = normalizeTitle('Forza Horizon 6');
    expect(normalizeTitle('Forza Horizon 6 Premium Edition')).toBe(base);
    expect(normalizeTitle(slugToTitle('forza-horizon-6-standard-edition'))).toBe(base);
    expect(normalizeTitle('Call of Duty: Black Ops 6 - Cross-Gen Bundle')).toBe(
      normalizeTitle('Call of Duty: Black Ops 6'),
    );
    expect(normalizeTitle('Call of Duty: Black Ops 6 - Launcher')).toBe(
      normalizeTitle('Call of Duty: Black Ops 6'),
    );
    expect(normalizeTitle('Rust Console Edition X|S')).toBe('rust');
  });

  it('keeps words that are part of a real title', () => {
    expect(normalizeTitle('Hogwarts Legacy')).toBe('hogwarts legacy');
    expect(normalizeTitle("Assassin's Creed Odyssey")).toBe('assassins creed odyssey');
    expect(normalizeTitle('Tom Clancy’s The Division 2')).toBe('tom clancys the division 2');
  });
});
