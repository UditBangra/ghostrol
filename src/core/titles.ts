// Normalizes game titles so editions and platform suffixes of the same game match.
// "Forza Horizon 6 Premium Edition" and "forza-horizon-6-standard-edition" both
// become "forza horizon 6". Words that also appear in real titles ("Legacy",
// "Ultimate") are only stripped when followed by "edition".

const EDITION =
  /\b(standard|deluxe|digital deluxe|premium|ultimate|gold|definitive|complete|enhanced|special|anniversary|game of the year|collectors|cross gen|game pass|cloud|launch|legacy|directors cut|console) edition$/;
const GOTY = /\b(goty|game of the year)$/;
const PLATFORM =
  /\b(xbox series x\|s|xbox series x s|xbox series|xbox one version|xbox one|for xbox|for windows|windows 10|windows|pc|x\|s)$/;
const LEFTOVER = /\b(edition|version|bundle|launcher|cross gen)$/;

export function normalizeTitle(title: string): string {
  let t = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip trailing edition and platform words until nothing changes.
  for (let guard = 0; guard < 6; guard++) {
    const before = t;
    for (const pattern of [PLATFORM, EDITION, GOTY, LEFTOVER]) t = t.replace(pattern, '').trim();
    if (t === before) break;
  }
  return t.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
}
