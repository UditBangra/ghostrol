// Builds the Chrome Web Store images from the real build's screenshots.
// Run `npm run shots` first; this reads .cache/shots and writes store/.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = join(import.meta.dirname, '..');
const shots = join(root, '.cache', 'shots');
const out = join(root, 'store');
const url = (p) => pathToFileURL(p).href;

const base = `
@font-face { font-family: Archivo; src: url(${url(join(root, 'site/fonts/archivo.woff2'))}); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: Fraktur; src: url(${url(join(root, 'site/fonts/unifraktur.woff2'))}); }
@font-face { font-family: 'Ghostrol G'; src: url(${url(join(root, 'site/fonts/pirata-one.woff2'))}); unicode-range: U+0047; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body {
  background: radial-gradient(900px 420px at 50% -140px, rgba(242,177,58,.16), transparent 70%), #0f1013;
  color: #ece6d6; font-family: Archivo, sans-serif; -webkit-font-smoothing: antialiased;
}
.brand { display: flex; align-items: center; gap: 10px; font: 400 30px/1 'Ghostrol G', Fraktur; color: #ece6d6; }
.brand img { width: 40px; height: 40px; }
h1 { font-weight: 800; font-stretch: 112%; letter-spacing: -.01em; line-height: 1.04; }
h1 em { font-style: normal; color: #f2b13a; }
p.sub { color: #aaa596; font-size: 21px; line-height: 1.45; }
.frame { border-radius: 14px; overflow: hidden; border: 1px solid #2b2e36;
  box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.4), 0 0 60px rgba(242,177,58,.08); }
.frame img { display: block; }
`;
const mark = url(join(root, 'site/img/mark-256.png'));
const art = url(join(root, 'assets/skull-art.png'));

// Caption on top, screenshot below and cut off by the bottom edge.
const stacked = (title, sub, shot, { w, x = 0, y = 0 }) => `
<style>
.top { padding: 44px 60px 0; display: flex; justify-content: space-between; align-items: flex-start; }
h1 { font-size: 46px; } p.sub { margin-top: 10px; max-width: 760px; }
.frame { position: absolute; left: 50%; top: 200px; transform: translateX(-50%); width: ${w}px; height: 640px; }
.frame img { width: ${w}px; margin: -${y}px 0 0 -${x}px; }
</style>
<div class="top"><div><h1>${title}</h1><p class="sub">${sub}</p></div>
<div class="brand"><img src="${mark}" alt="">Ghostrol</div></div>
<div class="frame"><img src="${url(join(shots, shot))}" alt=""></div>`;

const screens = [
  {
    name: '1-controls-over-game',
    html: `<style>
.top { padding: 40px 60px 0; display: flex; justify-content: space-between; align-items: flex-start; }
h1 { font-size: 46px; } p.sub { margin-top: 10px; }
.frame { position: absolute; left: 50%; top: 176px; transform: translateX(-50%); width: 1020px; height: 680px; background: #000; }
</style>
<div class="top"><div><h1>See every key <em>over the game</em></h1>
<p class="sub">Alt+C shows the controls mid-game, even in full screen.</p></div>
<div class="brand"><img src="${mark}" alt="">Ghostrol</div></div>
<div class="frame"><img src="${url(join(shots, 'game-panel.png'))}" alt="" style="width:1414px;margin:-6px 0 0 -197px"></div>`,
  },
  {
    name: '2-knows-your-game',
    html: `<style>
.wrap { display: grid; grid-template-columns: 1fr 380px; gap: 70px; align-items: center; height: 100%; padding: 0 110px 0 90px; }
h1 { font-size: 62px; } p.sub { margin-top: 22px; font-size: 23px; max-width: 520px; }
.brand { margin-bottom: 48px; }
.frame { width: 380px; height: 633px; }
.frame img { width: 380px; }
</style>
<div class="wrap"><div><div class="brand"><img src="${mark}" alt="">Ghostrol</div>
<h1>It knows the game <em>you start</em></h1>
<p class="sub">Launch any game on Xbox Cloud Gaming and the right keys load on their own. The popup shows them at a glance.</p></div>
<div class="frame"><img src="${url(join(shots, 'popup-game.png'))}" alt=""></div></div>`,
  },
  {
    name: '3-made-for-games',
    html: stacked(
      'Presets made for <em>real games</em>',
      'Forza Horizon, Call of Duty, Helldivers 2, Cyberpunk 2077 and more, plus a layout for every genre.',
      'studio-presets.png',
      { w: 1160 },
    ),
  },
  {
    name: '4-every-game',
    html: stacked(
      'Every cloud game <em>gets a preset</em>',
      'All 3,658 games in the catalog are covered automatically. Change any of them here.',
      'studio-games.png',
      { w: 1160 },
    ),
  },
  {
    name: '5-free-and-private',
    html: stacked(
      'Free. No account. <em>No tracking.</em>',
      'Open source, no trial, and it never sends your data anywhere. Not affiliated with Microsoft or Xbox.',
      'studio-welcome.png',
      { w: 1160 },
    ),
  },
];

const tile = (w, h, big) => `<style>
body { display: flex; align-items: center; justify-content: center; gap: ${big ? 48 : 18}px;
  background: radial-gradient(${w}px ${h}px at 30% 40%, rgba(242,177,58,.18), transparent 70%), #0f1013; }
img { width: ${big ? 300 : 130}px; height: ${big ? 300 : 130}px; filter: drop-shadow(0 0 24px rgba(242,177,58,.25)); }
.name { font: 400 ${big ? 120 : 56}px/1 'Ghostrol G', Fraktur; }
.line { margin-top: ${big ? 18 : 8}px; color: #aaa596; font-size: ${big ? 30 : 15}px; font-weight: 600; max-width: ${big ? 640 : 220}px; line-height: 1.3; }
.line b { color: #f2b13a; font-weight: 700; }
</style>
<img src="${art}" alt=""><div><div class="name">Ghostrol</div>
<div class="line"><b>Keyboard and mouse</b> for Xbox Cloud Gaming</div></div>`;

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const render = async (name, w, h, body) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  // A file page, so it may load the local fonts and screenshots.
  const file = join(root, '.cache', `store-${name}.html`);
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head><body>${body}</body></html>`,
  );
  await page.goto(url(file));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await page.close();
};
for (const s of screens) await render(s.name, 1280, 800, s.html);
await render('promo-small-440x280', 440, 280, tile(440, 280, false));
await render('promo-marquee-1400x560', 1400, 560, tile(1400, 560, true));
await browser.close();
console.log(`Store images in ${out}`);
