// Turns the skull artwork (assets/skull-art.png) into the extension icons in
// assets/icons/. Run it after changing the artwork:
//   node scripts/make-icons.mjs
//
// The artwork is detailed engraving, which turns to speckle at toolbar sizes. So:
//   - 48 px and up: a clean, gradual resize with a light sharpen.
//   - 16 and 32 px: more contrast, a dark outline so the shape holds on light toolbars,
//     and the ember eyes painted back in after the resize, since averaging washes them out.
// The image work runs in Playwright's Chromium, which this project already uses for tests.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 128, 256];

const art = (await readFile(join(root, 'assets/skull-art.png'))).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const icons = await page.evaluate(
  async ({ art, sizes }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${art}`;
    await img.decode();

    const canvas = (w, h = w) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const pixels = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height);

    // The source is not square and parts of it are slightly see-through. Crop to the
    // artwork, center it on a square with a small margin, and make the solid parts solid.
    const src = canvas(img.width, img.height);
    src.getContext('2d').drawImage(img, 0, 0);
    const data = pixels(src);
    let [x0, y0, x1, y1] = [Infinity, Infinity, 0, 0];
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (data.data[(y * img.width + x) * 4 + 3] > 128) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    }
    for (let i = 3; i < data.data.length; i += 4) {
      const a = data.data[i];
      data.data[i] = a > 200 ? 255 : a < 24 ? 0 : a;
    }
    src.getContext('2d').putImageData(data, 0, 0);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const side = Math.round(Math.max(w, h) * 1.04);
    const master = canvas(side);
    master.getContext('2d').drawImage(src, x0, y0, w, h, (side - w) / 2, (side - h) / 2, w, h);

    // Where the eyes are, from their ember pixels, as fractions of the square.
    const m = pixels(master);
    const eyes = [
      { x: 0, y: 0, n: 0 },
      { x: 0, y: 0, n: 0 },
    ];
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const i = (y * side + x) * 4;
        const [r, g, b, a] = [m.data[i], m.data[i + 1], m.data[i + 2], m.data[i + 3]];
        if (a > 128 && r > 200 && g < 150 && b < 80 && r - g > 90) {
          const eye = eyes[x < side / 2 ? 0 : 1];
          eye.x += x;
          eye.y += y;
          eye.n++;
        }
      }
    }
    const eyeAt = eyes.map((e) => ({ x: e.x / e.n / side, y: e.y / e.n / side }));

    /** Halves the image until one last step reaches the size, so no detail is skipped. */
    function resize(from, size, filter = 'none') {
      let current = from;
      while (current.width / 2 >= size * 1.5) {
        const next = canvas(Math.round(current.width / 2));
        const ctx = next.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(current, 0, 0, next.width, next.height);
        current = next;
      }
      const out = canvas(size);
      const ctx = out.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = filter;
      ctx.drawImage(current, 0, 0, size, size);
      return out;
    }

    /** Unsharp mask: push each color away from its blurred neighbourhood. */
    function sharpen(c, amount, radius) {
      const blurred = canvas(c.width);
      const ctx = blurred.getContext('2d');
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(c, 0, 0);
      const a = pixels(c);
      const b = pixels(blurred);
      for (let i = 0; i < a.data.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          a.data[i + k] = Math.max(
            0,
            Math.min(255, a.data[i + k] + amount * (a.data[i + k] - b.data[i + k])),
          );
        }
      }
      c.getContext('2d').putImageData(a, 0, 0);
      return c;
    }

    /** A dark ring around the shape, one pixel wide, drawn behind it. */
    function outline(c) {
      const size = c.width;
      const src = pixels(c);
      const ring = c.getContext('2d').createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let alpha = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
              alpha = Math.max(alpha, src.data[(ny * size + nx) * 4 + 3]);
            }
          }
          const i = (y * size + x) * 4;
          ring.data.set([13, 12, 15, alpha], i);
        }
      }
      const out = canvas(size);
      const ctx = out.getContext('2d');
      ctx.putImageData(ring, 0, 0);
      ctx.drawImage(c, 0, 0);
      return out;
    }

    /** Paints the ember eyes back in: a hot core in a dark socket. */
    function eyesBack(c) {
      const size = c.width;
      const ctx = c.getContext('2d');
      const dot = size >= 32 ? 2 : 1;
      for (const e of eyeAt) {
        const x = Math.round(e.x * size - dot / 2);
        const y = Math.round(e.y * size - dot / 2);
        if (size >= 32) {
          ctx.fillStyle = 'rgba(13, 12, 15, 0.45)';
          ctx.fillRect(x - 1, y - 1, dot + 2, dot + 2);
        }
        ctx.fillStyle = '#ff6a1f';
        ctx.fillRect(x, y, dot, dot);
        if (size >= 32) {
          ctx.fillStyle = '#ffd68a';
          ctx.fillRect(x, y, 1, 1);
        }
      }
      return c;
    }

    const out = {};
    for (const size of sizes) {
      let c;
      if (size >= 48) {
        c = sharpen(resize(master, size), size >= 128 ? 0.35 : 0.5, 0.8);
      } else {
        c = resize(master, size, 'contrast(1.35) brightness(1.08) saturate(0.9)');
        c = sharpen(c, 0.6, 0.6);
        c = eyesBack(outline(c));
      }
      out[size] = c.toDataURL('image/png').split(',')[1];
    }
    return out;
  },
  { art, sizes: SIZES },
);
await browser.close();

await mkdir(join(root, 'assets/icons'), { recursive: true });
for (const size of SIZES) {
  await writeFile(join(root, `assets/icons/${size}.png`), Buffer.from(icons[size], 'base64'));
}
console.log(`Wrote assets/icons/{${SIZES.join(',')}}.png`);
