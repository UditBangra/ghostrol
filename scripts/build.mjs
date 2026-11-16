// Builds the extension into dist/.
//   node scripts/build.mjs           one production build
//   node scripts/build.mjs --watch   rebuild on change
//   node scripts/build.mjs --zip     build, then write release/<name>-<version>.zip

import { context, build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';
import { manifest } from './manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

/**
 * Large JSON (the game catalog) is shipped as a JSON.parse call on a string. Chrome reads
 * that much faster than the same data written as a JavaScript object, which matters in the
 * background worker because it starts up again after every idle period.
 */
const jsonAsString = {
  name: 'json-as-string',
  setup(b) {
    b.onLoad({ filter: /catalog\.json$/ }, async (args) => {
      const text = await readFile(args.path, 'utf8');
      return { contents: `export default JSON.parse(${JSON.stringify(text)});`, loader: 'js' };
    });
  },
};

const shared = {
  bundle: true,
  plugins: [jsonAsString],
  target: 'chrome111',
  charset: 'utf8',
  logLevel: 'info',
  legalComments: 'none',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.woff2': 'file', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
};

const scripts = {
  ...shared,
  entryPoints: {
    page: 'src/page/index.ts',
    bridge: 'src/bridge/index.ts',
    background: 'src/background/index.ts',
  },
  outdir: dist,
  format: 'iife',
};

const pages = {
  ...shared,
  entryPoints: { popup: 'src/popup/main.tsx', studio: 'src/studio/main.tsx' },
  outdir: dist,
  format: 'esm',
  splitting: false,
  // Fonts are copied into dist/fonts by copyStatic, next to the built CSS.
  external: ['fonts/*'],
};

async function copyStatic() {
  await mkdir(join(dist, 'fonts'), { recursive: true });
  await mkdir(join(dist, 'icons'), { recursive: true });
  const fonts = dirname(require.resolve('@fontsource-variable/archivo/package.json'));
  await cp(join(fonts, 'files/archivo-latin-wdth-normal.woff2'), join(dist, 'fonts/archivo.woff2'));
  await cp(
    join(fonts, 'files/archivo-latin-ext-wdth-normal.woff2'),
    join(dist, 'fonts/archivo-ext.woff2'),
  );
  // The blackletter face for the Ghostrol wordmark.
  const display = dirname(require.resolve('@fontsource/unifrakturmaguntia/package.json'));
  await cp(
    join(display, 'files/unifrakturmaguntia-latin-400-normal.woff2'),
    join(dist, 'fonts/unifraktur.woff2'),
  );
  // Its fraktur G is hard to read, so the wordmark takes its G from Pirata One.
  const pirata = dirname(require.resolve('@fontsource/pirata-one/package.json'));
  await cp(
    join(pirata, 'files/pirata-one-latin-400-normal.woff2'),
    join(dist, 'fonts/pirata-one.woff2'),
  );
  // All three fonts are under the SIL Open Font License, which travels with the font files.
  await cp(join(fonts, 'LICENSE'), join(dist, 'fonts/LICENSE-archivo.txt'));
  await cp(join(display, 'LICENSE'), join(dist, 'fonts/LICENSE-unifraktur.txt'));
  await cp(join(pirata, 'LICENSE'), join(dist, 'fonts/LICENSE-pirata-one.txt'));
  await cp(join(root, 'public'), dist, { recursive: true });
  // The GPL travels with every copy, including the store zip.
  await cp(join(root, 'LICENSE'), join(dist, 'LICENSE.txt'));
  // Bundled libraries under MIT ask for their notice to travel with copies too.
  const notices = [];
  for (const name of ['preact', 'lenis']) {
    const dir = join(root, 'node_modules', name);
    const { version } = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    const text = (await readFile(join(dir, 'LICENSE'), 'utf8')).trim();
    notices.push(`${name} ${version}\n\n${text}`);
  }
  await writeFile(
    join(dist, 'THIRD-PARTY-NOTICES.txt'),
    `Ghostrol includes these libraries. Fonts carry their own licenses in fonts/.\n\n${notices.join('\n\n----------------------------------------\n\n')}\n`,
  );
  await cp(join(root, 'src/popup/popup.html'), join(dist, 'popup.html'));
  await cp(join(root, 'src/studio/studio.html'), join(dist, 'studio.html'));
  await writeFile(join(dist, 'manifest.json'), JSON.stringify(manifest(pkg.version), null, 2));
  // Made from assets/skull-art.png by scripts/make-icons.mjs.
  await cp(join(root, 'assets/icons'), join(dist, 'icons'), { recursive: true });
}

/** 1980-01-01 in MS-DOS date format. A fixed date keeps the zip reproducible. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

async function zip() {
  const files = [];
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const full = join(dir, name);
      if ((await stat(full)).isDirectory()) await walk(full);
      else files.push(full);
    }
  }
  await walk(dist);

  const local = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(relative(dist, file).split('\\').join('/'));
    const data = await readFile(file);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + packed.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  await mkdir(join(root, 'release'), { recursive: true });
  const out = join(root, 'release', `${pkg.name}-${pkg.version}.zip`);
  await writeFile(out, Buffer.concat([...local, ...central, end]));
  console.log(`Packed ${files.length} files into ${relative(root, out)}`);
}

await rm(dist, { recursive: true, force: true });
if (args.has('--watch')) {
  await copyStatic();
  const contexts = await Promise.all([context(scripts), context(pages)]);
  await Promise.all(contexts.map((c) => c.watch()));
  console.log('Watching for changes. Reload the extension in chrome://extensions after edits.');
} else {
  await Promise.all([build(scripts), build(pages)]);
  await copyStatic();
  if (args.has('--zip')) await zip();
}
