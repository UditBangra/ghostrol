// Draws a simple skull over crossed bones into assets/mark.svg. The overlay over the game
// falls back to it when the page will not load the skull artwork from the extension.
//   node scripts/draw-icon.mjs
//
// The right half of each feature is written once and mirrored around x = 256.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const INK = '#0d0c0f';
const BONE = '#ebe3cd';
const EMBER = '#ff5a1f';
const EMBER_HOT = '#ffd68a';
const OUTLINE = 16; // half width, outside the shape

const fmt = (n) => +n.toFixed(1);
const mx = (x) => fmt(512 - x);
/** Mirror every coordinate pair in a path around x = 256. */
const flip = (d) =>
  d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${mx(+x)} ${y}`);

// Skull outline, right half, from the top of the crown to the chin.
const START = [256, 50];
// prettier-ignore
const RIGHT = [
  [[334, 50], [398, 104], [400, 184]], // crown to the widest point
  [[401, 220], [392, 242], [382, 254]], // in to the temple
  [[396, 270], [404, 290], [398, 306]], // out over the cheekbone
  [[392, 322], [370, 336], [348, 344]], // in under the cheekbone
  [[344, 356], [338, 366], [332, 374]], // down to the upper teeth
  [[342, 392], [350, 408], [348, 424]], // jaw hinge
  [[346, 450], [312, 472], [282, 476]], // jaw to the chin
  [[272, 478], [264, 478], [256, 478]],
];

function outlinePath() {
  let d = `M${START[0]} ${START[1]}`;
  for (const [c1, c2, e] of RIGHT) d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e[0]} ${e[1]}`;
  const ends = [START, ...RIGHT.map((s) => s[2])];
  for (let i = RIGHT.length - 1; i >= 0; i--) {
    const [c1, c2] = RIGHT[i];
    const e = ends[i];
    d += ` C${mx(c2[0])} ${c2[1]} ${mx(c1[0])} ${c1[1]} ${mx(e[0])} ${e[1]}`;
  }
  return d + ' Z';
}

/** One bone with two knuckles at each end. `grow` widens it, for the ink outline. */
function bone(x1, y1, x2, y2, grow) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const knobs = [
    [x1, y1, -1],
    [x2, y2, 1],
  ].flatMap(([x, y, dir]) =>
    [1, -1].map(
      (s) =>
        `<circle cx="${fmt(x - ux * dir * 4 - uy * 25 * s)}" cy="${fmt(y - uy * dir * 4 + ux * 25 * s)}" r="${30 + grow}"/>`,
    ),
  );
  return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke-width="${38 + grow * 2}" stroke-linecap="round" fill="none"/>${knobs.join('')}`;
}
const bones = (grow) => bone(100, 100, 412, 412, grow) + bone(412, 100, 100, 412, grow);

const EYE =
  'M276 254 C302 236 336 228 362 232 C372 254 368 282 352 296 C336 310 304 310 290 300 C276 290 272 272 276 254 Z';
const NOSE =
  'M256 306 C246 322 233 341 235 355 C237 366 248 367 256 354 C264 367 275 366 277 355 C279 341 266 322 256 306 Z';

const eyes = [318, 194]
  .map(
    (cx) =>
      `<circle cx="${cx}" cy="272" r="30" fill="url(#gr-glow)"/><circle cx="${cx}" cy="272" r="11" fill="${EMBER_HOT}"/>`,
  )
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">
  <defs>
    <path id="gr-skull" d="${outlinePath()}"/>
    <radialGradient id="gr-glow">
      <stop offset="0" stop-color="${EMBER_HOT}"/>
      <stop offset="0.35" stop-color="${EMBER}"/>
      <stop offset="1" stop-color="${EMBER}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g fill="${INK}" stroke="${INK}">${bones(OUTLINE)}</g>
  <g fill="${BONE}" stroke="${BONE}">${bones(0)}</g>
  <use xlink:href="#gr-skull" fill="${INK}" stroke="${INK}" stroke-width="${OUTLINE * 2}" stroke-linejoin="round"/>
  <use xlink:href="#gr-skull" fill="${BONE}"/>
  <path d="${EYE} ${flip(EYE)}" fill="${INK}"/>
  ${eyes}
  <path d="${NOSE}" fill="${INK}"/>
  <g stroke="${INK}" stroke-linecap="round" fill="none">
    <path d="M180 400 C220 408 292 408 332 400 M226 380 L226 426 M256 382 L256 430 M286 380 L286 426" stroke-width="12"/>
  </g>
</svg>
`;

await writeFile(join(root, 'assets/mark.svg'), svg);
console.log('Wrote assets/mark.svg');
