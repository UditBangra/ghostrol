// Builds src/data/catalog.json from Microsoft's public Xbox Cloud Gaming catalog.
//
// Sources (no account needed):
//   catalog.gamepass.com/sigls/v2  collection lists used by xbox.com/play itself
//   displaycatalog.mp.microsoft.com product titles and store categories
//
// The collection IDs come from the enum in xCloud's own web bundle (see docs/RESEARCH.md).
// Run with: npm run catalog

import { writeFile } from 'node:fs/promises';

const MARKET = 'US';
const LANGUAGE = 'en-us';
const BATCH = 100;

const COLLECTIONS = {
  popular: '6a589fa0-d493-472b-8e20-3813699d7056', // CloudMostPopular, ordered by popularity
  all: '1bf84c2b-0643-4591-893f-d9edb703f692', // CloudAll
  nativeMkb: '3aa7a358-f15b-476b-af7e-134a250c08a0', // CloudPlayWithMouseAndKeyboard
};

// Fortnite supports mouse and keyboard in the browser without being listed in the
// collection (support.xbox.com, "Play Xbox cloud games on PC with mouse and keyboard").
const EXTRA_NATIVE_MOUSE = ['BT5P2X999VH2'];

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url);
  if (res.ok) return res.json();
  if (attempt < 4 && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 500 * attempt));
    return fetchJson(url, attempt + 1);
  }
  throw new Error(`${res.status} ${res.statusText} for ${url}`);
}

async function collection(id) {
  const data = await fetchJson(
    `https://catalog.gamepass.com/sigls/v2?id=${id}&language=${LANGUAGE}&market=${MARKET}`,
  );
  return data.filter((entry) => entry.id).map((entry) => entry.id.toUpperCase());
}

async function products(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const data = await fetchJson(
      `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${chunk.join(',')}&market=${MARKET}&languages=${LANGUAGE}`,
    );
    for (const p of data.Products ?? []) out.set(p.ProductId.toUpperCase(), p);
    process.stdout.write(`\r  resolved ${Math.min(i + BATCH, ids.length)} / ${ids.length}`);
  }
  process.stdout.write('\n');
  return out;
}

// Trademark symbols, and en and em dashes, written as escapes to keep this file plain ASCII.
const SYMBOLS = new RegExp('[\\u2122\\u00ae\\u00a9]', 'g');
const DASHES = new RegExp('\\s*[\\u2013\\u2014]\\s*', 'g');

// Store titles carry edition and platform noise that makes poor display names.
function cleanTitle(title) {
  return title
    .replace(SYMBOLS, '')
    .replace(/\s*\((Xbox Series X\|S|Xbox One|Windows|PC|Game Preview|Xbox)\)\s*/gi, ' ')
    .replace(/\s+(Standard|Game Pass|Cloud)\s+Edition$/i, '')
    .replace(DASHES, ': ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categories(product) {
  const props = product.Properties ?? {};
  const list = props.Categories ?? (props.Category ? [props.Category] : []);
  return [...new Set(list.filter(Boolean))];
}

async function main() {
  console.log('Fetching collections');
  const [popular, all, nativeMkb] = await Promise.all([
    collection(COLLECTIONS.popular),
    collection(COLLECTIONS.all),
    collection(COLLECTIONS.nativeMkb),
  ]);
  console.log(`  popular ${popular.length}, all ${all.length}, native mouse ${nativeMkb.length}`);

  // Popular order first, then anything only present in the full list.
  const ordered = [...new Set([...popular, ...all, ...nativeMkb])];
  console.log('Resolving titles');
  const details = await products(ordered);

  const genreTable = [];
  const genreIndex = (name) => {
    let i = genreTable.indexOf(name);
    if (i === -1) i = genreTable.push(name) - 1;
    return i;
  };

  const native = new Set([...nativeMkb, ...EXTRA_NATIVE_MOUSE]);
  const games = [];
  for (const id of ordered) {
    const p = details.get(id);
    if (!p) continue;
    const title = cleanTitle(p.LocalizedProperties?.[0]?.ProductTitle ?? '');
    if (!title) continue;
    const entry = { id, title, genres: categories(p).map(genreIndex) };
    if (native.has(id)) entry.nativeMouse = true;
    games.push(entry);
  }

  const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    market: MARKET,
    genres: genreTable,
    games,
  };
  await writeFile(new URL('../src/data/catalog.json', import.meta.url), JSON.stringify(output));
  console.log(`Wrote ${games.length} games, ${genreTable.length} genres`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
