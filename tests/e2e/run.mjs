// End-to-end check of the built extension in Chromium.
//
// xbox.com is replaced by a small local page served at the real URLs, so the content
// scripts inject exactly as they would on Xbox Cloud Gaming, and the page reads
// navigator.getGamepads() the way the site does. Run after a build: npm run e2e
//
// Pass --shots to also save screenshots of the popup and Studio for design review.

import { chromium } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'dist');
const shots = process.argv.includes('--shots');
const shotDir = join(root, '.cache', 'shots');

const FAKE_XCLOUD = `<!doctype html><html><body style="margin:0;background:#000">
<video style="width:100vw;height:100vh;display:block"></video>
<script>
  window.readPad = () => {
    const pad = navigator.getGamepads()[0];
    if (!pad) return null;
    return {
      id: pad.id,
      connected: pad.connected,
      mapping: pad.mapping,
      timestamp: pad.timestamp,
      axes: [...pad.axes],
      buttons: pad.buttons.map((b) => b.value),
    };
  };
  window.connectedEvents = 0;
  window.addEventListener('gamepadconnected', () => window.connectedEvents++);

  // Poll every frame like the xCloud player, and remember the most each button was pressed.
  window.peak = new Array(17).fill(0);
  const poll = () => {
    const pad = navigator.getGamepads()[0];
    if (pad) pad.buttons.forEach((b, i) => (window.peak[i] = Math.max(window.peak[i], b.value)));
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  window.resetPeak = () => window.peak.fill(0);

  // xCloud listens on window, after us, for the keys and pointer events it streams to
  // games with their own mouse and keyboard support. Count what gets through.
  window.siteKeys = 0;
  window.sitePointer = 0;
  window.addEventListener('keydown', () => window.siteKeys++);
  for (const type of ['pointermove', 'pointerdown', 'pointerup']) {
    window.addEventListener(type, () => window.sitePointer++);
  }
</script></body></html>`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

/**
 * Finds elements of our overlay, which lives in a closed shadow root, through the
 * DevTools protocol. Returns those whose class list has the given class.
 */
async function overlayElements(page, className) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const found = [];
  const text = (node) =>
    node.nodeType === 3 ? node.nodeValue : (node.children ?? []).map(text).join('');
  const walk = (node) => {
    const attrs = node.attributes ?? [];
    const attr = (name) => {
      for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === name) return attrs[i + 1];
      return null;
    };
    if ((attr('class') ?? '').split(' ').includes(className)) {
      found.push({ nodeId: node.nodeId, hidden: attr('hidden') !== null, text: text(node), attr });
    }
    for (const child of node.children ?? []) walk(child);
    for (const shadow of node.shadowRoots ?? []) walk(shadow);
  };
  walk(root);
  return {
    found,
    async click(item) {
      const { model } = await cdp.send('DOM.getBoxModel', { nodeId: item.nodeId });
      const [x1, y1, , , x3, y3] = model.content;
      await page.mouse.click((x1 + x3) / 2, (y1 + y3) / 2);
    },
  };
}

const panelOpen = async (page) =>
  (await overlayElements(page, 'scrim')).found.some((el) => !el.hidden);

/** Elements whose text or children spill out of their box, or out of the window. */
function overflowIssues(page) {
  return page.evaluate(() => {
    const issues = new Set();
    const width = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.display === 'inline') continue;
      const box = el.getBoundingClientRect();
      if (!box.width) continue;
      const name = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 24)}"`;
      if (box.right > width + 1) issues.add(`past the window: ${name}`);
      if (style.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1) {
        issues.add(`spills ${el.scrollWidth - el.clientWidth}px: ${name}`);
      }
    }
    return [...issues];
  });
}

async function until(fn, timeout = 4000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value || Date.now() > end) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
}

const userData = await mkdtemp(join(tmpdir(), 'ghostrol-e2e-'));
// Playwright's bundled Chromium still side-loads extensions from the command line
// (branded Chrome and Edge no longer do). channel 'chromium' allows headless extensions.
const context = await chromium.launchPersistentContext(userData, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});

try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15000 }));
  const extensionId = new URL(worker.url()).host;
  check('Chrome accepts the manifest and starts the service worker', !!extensionId, extensionId);

  await context.route('https://www.xbox.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_XCLOUD }),
  );

  // Close the welcome tab opened on install.
  for (const p of context.pages()) if (p.url().startsWith('chrome-extension://')) await p.close();

  const page = await context.newPage();
  await page.goto(
    'https://www.xbox.com/en-US/play/launch/forza-horizon-6-standard-edition/9N431PX143P8',
  );
  // The welcome tab can open after the loop above and cover this one. A background tab
  // gets only a frame or two a second, which starves the site's controller polling.
  await page.bringToFront();

  // The first start after a build is slow while Chrome compiles the extension.
  const pad = await until(() => page.evaluate(() => window.readPad()), 10000);
  check('virtual controller appears on a stream page', !!pad);
  check(
    'it looks like a standard Xbox pad',
    pad?.mapping === 'standard' && pad?.connected === true && /Xbox/.test(pad?.id ?? ''),
    pad?.id,
  );
  check('it has 4 axes and 17 buttons', pad?.axes.length === 4 && pad?.buttons.length === 17);
  check('a gamepadconnected event fired', (await page.evaluate(() => window.connectedEvents)) >= 1);

  // Forza preset: W is the right trigger at full strength right away, Space is A (e-brake).
  await page.keyboard.down('KeyW');
  const full = await page.evaluate(() => window.readPad());
  check('W gives full throttle at once', full.buttons[7] === 1, String(full.buttons[7]));
  check('timestamp moves when input changes', full.timestamp > pad.timestamp);
  const chips = (await overlayElements(page, 'chip')).found;
  check(
    'a key press shows the key and its controller button in the corner',
    chips.some((c) => c.text.includes('W') && c.text.includes('RT')),
    chips.map((c) => c.text).join(', '),
  );
  await page.keyboard.up('KeyW');
  // It is gone 0.8 s after the key comes up (0.6 s shown, then a 0.2 s fade). Timed
  // rather than slept on: a busy test browser can run page timers a little late, so the
  // limit leaves room for that and for polling, and still fails the old 1.8 s.
  const releasedAt = Date.now();
  const chipShown = async () =>
    (await overlayElements(page, 'chip')).found.some((c) => c.text.includes('Accelerate'));
  const stillThere = await chipShown();
  const gone = await until(async () => !(await chipShown()), 3000);
  const goneAfter = Date.now() - releasedAt;
  check(
    'the key chip stays a moment, then is gone about 0.8 s after the key comes up',
    stillThere && gone && goneAfter < 1400,
    `${goneAfter} ms`,
  );

  await page.keyboard.down('Space');
  const brake = await page.evaluate(() => window.readPad());
  check('Space presses A (e-brake in Forza)', brake.buttons[0] === 1);
  await page.keyboard.up('Space');
  // A press shows for at least 60 ms so quick taps are never lost.
  await page.waitForTimeout(90);
  const released = await page.evaluate(() => window.readPad());
  check('releasing the key releases the button', released.buttons[0] === 0);

  // An instant tap, the way people press Back, must still reach the site.
  await page.evaluate(() => window.resetPeak());
  await page.keyboard.press('Backspace');
  // Waits rather than fixed sleeps: without a GPU a frame can take longer than the tap.
  const tapSeen = await until(() => page.evaluate(() => window.peak[1] === 1));
  const letGo = await until(() => page.evaluate(() => window.readPad().buttons[1] === 0));
  check('an instant Backspace tap reaches the site as B', tapSeen);
  check('and lets go afterwards', letGo);

  // Menus: arrow keys are the D-pad and Backspace is B.
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('Backspace');
  const menu = await page.evaluate(() => window.readPad());
  check('arrow down presses D-pad down for menus', menu.buttons[13] === 1);
  check('Backspace presses B to go back', menu.buttons[1] === 1);
  check('arrow keys do not steer', menu.axes[0] === 0 && menu.axes[2] === 0);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('Backspace');

  await page.keyboard.down('KeyD');
  const turning = await page.evaluate(() => window.readPad());
  await page.waitForTimeout(220);
  const steer = await page.evaluate(() => window.readPad());
  check(
    'D eases the steering in',
    turning.axes[0] > 0 && turning.axes[0] < 0.95,
    String(turning.axes[0]),
  );
  check('D steers right on the left stick', steer.axes[0] > 0.9, String(steer.axes[0]));
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(250);
  const centered = await page.evaluate(() => window.readPad());
  check(
    'the stick eases back to center after release',
    centered.axes[0] === 0,
    String(centered.axes[0]),
  );

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'chat';
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.type('wasd');
  const typed = await page.evaluate(() => document.getElementById('chat').value);
  const afterTyping = await page.evaluate(() => window.readPad());
  check(
    'typing in a text field types, and does not drive the controller',
    typed === 'wasd' && afterTyping.axes[0] === 0,
    typed,
  );
  await page.evaluate(() => document.getElementById('chat').remove());

  // A controller-only game: keys the preset does not use still reach the site.
  const keysBefore = await page.evaluate(() => window.siteKeys);
  await page.keyboard.press('KeyZ');
  check(
    'keys the preset does not use still reach the site',
    (await page.evaluate(() => window.siteKeys)) > keysBefore,
  );

  // Shortcuts work inside the page, which is what makes them work in full screen.
  await page.keyboard.press('Alt+KeyK');
  check(
    'Alt+K pauses from inside the page',
    await until(async () => (await page.evaluate(() => window.readPad())) === null),
  );
  await page.waitForTimeout(500);
  await page.keyboard.press('Alt+KeyK');
  check('and Alt+K turns it back on', !!(await until(() => page.evaluate(() => window.readPad()))));

  // Controls panel: a tap keeps it open, Esc closes it, holding the shortcut peeks.
  await page.waitForTimeout(500);
  await page.keyboard.press('Alt+KeyC');
  check('a tap on Alt+C opens the controls panel', await until(() => panelOpen(page)));
  const choices = await overlayElements(page, 'choice');
  const pick = choices.found.find(
    (c) => !c.text.startsWith('Automatic') && c.attr('aria-checked') === 'false',
  );
  if (pick) await choices.click(pick);
  const assigned = await until(async () => {
    const { assignments } = await worker.evaluate(() => chrome.storage.sync.get('assignments'));
    return Object.values(assignments ?? {})[0];
  });
  check('picking a preset in the panel saves it for this game', !!assigned, pick?.text);
  await page.waitForTimeout(400);
  check('and the panel stays open after the pick', await panelOpen(page));
  if (shots) {
    await mkdir(shotDir, { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(shotDir, 'game-panel.png') });
  }
  await page.keyboard.press('Escape');
  check('Esc closes the panel', await until(async () => !(await panelOpen(page))));
  await worker.evaluate(() => chrome.storage.sync.remove('assignments'));
  await page.waitForTimeout(500);
  await page.keyboard.down('AltLeft');
  await page.keyboard.down('KeyC');
  await page.waitForTimeout(450);
  const peeking = await panelOpen(page);
  await page.keyboard.up('KeyC');
  await page.keyboard.up('AltLeft');
  check(
    'holding Alt+C peeks, and letting go closes it',
    peeking && (await until(async () => !(await panelOpen(page)))),
  );

  // Where Winds Meet: the store also tags it Fighting, but it looks around with the
  // mouse, so it must get a preset that uses the mouse and the prompt to capture it.
  const winds = await context.newPage();
  await winds.goto('https://www.xbox.com/en-US/play/launch/where-winds-meet/9N76QGDS5GJR');
  await until(() => winds.evaluate(() => window.readPad()), 10000);
  const promptShown = async () =>
    (await overlayElements(winds, 'prompt')).found.some((el) => !el.hidden);
  check('Where Winds Meet uses the mouse, and the prompt to capture it shows', await until(promptShown));
  // With a keys-only preset, a click on the game says why nothing happened.
  await worker.evaluate(() =>
    chrome.storage.sync.set({ assignments: { 'where winds meet': 'layout:fighting' } }),
  );
  await until(async () => !(await promptShown()));
  await winds.mouse.click(640, 400);
  const toldWhy = await until(async () =>
    (await overlayElements(winds, 'toast')).found.some((el) => el.text.includes('keys only')),
  );
  check('clicking the game with a keys-only preset says why the mouse stays free', toldWhy);
  await worker.evaluate(() => chrome.storage.sync.remove('assignments'));
  await winds.close();

  // A game with native mouse support: the extension should stand by.
  const native = await context.newPage();
  await native.goto('https://www.xbox.com/en-US/play/launch/fortnite/BT5P2X999VH2');
  await native.waitForTimeout(800);
  check(
    'games with their own mouse support are left alone',
    (await native.evaluate(() => window.readPad())) === null,
  );

  // The user picked Ghostrol in a game with its own mouse support. In full screen xCloud
  // streams every key and pointer event to such a game, which then switches to mouse
  // and keyboard, so the site must see none of them.
  await worker.evaluate(() => chrome.storage.sync.set({ nativePrefs: { fortnite: 'emulate' } }));
  const exclusive = await context.newPage();
  await exclusive.goto('https://www.xbox.com/en-US/play/launch/fortnite/BT5P2X999VH2');
  check(
    'choosing the virtual controller in such a game shows it',
    !!(await until(() => exclusive.evaluate(() => window.readPad()))),
  );
  await exclusive.keyboard.down('KeyW');
  await exclusive.keyboard.press('KeyZ');
  await exclusive.keyboard.press('Escape');
  const walking = await exclusive.evaluate(() => window.readPad());
  await exclusive.keyboard.up('KeyW');
  await exclusive.mouse.move(200, 200);
  await exclusive.mouse.move(420, 360);
  await exclusive.mouse.down();
  await exclusive.mouse.up();
  const seen = await exclusive.evaluate(() => ({
    keys: window.siteKeys,
    pointer: window.sitePointer,
  }));
  check('W still drives the controller there', walking?.axes[1] < 0, String(walking?.axes[1]));
  check('the site sees none of the keys', seen.keys === 0, String(seen.keys));
  check('and no pointer input', seen.pointer === 0, String(seen.pointer));

  // A details page is browsing, not playing.
  const details = await context.newPage();
  await details.goto(
    'https://www.xbox.com/en-US/play/games/forza-horizon-6-standard-edition/9N431PX143P8',
  );
  await details.waitForTimeout(800);
  check(
    'no virtual controller while browsing',
    (await details.evaluate(() => window.readPad())) === null,
  );

  // xbox.com moves between pages with history.pushState. The bridge hears it through the
  // Navigation API, well before its 3 s safety check would.
  await details.bringToFront();
  await details.evaluate(() =>
    history.pushState({}, '', '/en-US/play/launch/forza-horizon-6-standard-edition/9N431PX143P8'),
  );
  const pushedAt = Date.now();
  const padAfterPush = await until(() => details.evaluate(() => window.readPad()), 2500);
  const pushMs = Date.now() - pushedAt;
  check(
    'starting a game by in-page navigation brings the controller within a second',
    !!padAfterPush && pushMs < 1000,
    `${pushMs} ms`,
  );

  // xCloud reads the controller every 4 ms, so each read has to stay cheap.
  const perRead = await details.evaluate(() => {
    const n = 20000;
    const start = performance.now();
    for (let i = 0; i < n; i++) navigator.getGamepads();
    return ((performance.now() - start) / n) * 1000;
  });
  check(
    'a controller read takes under 20 microseconds',
    perRead < 20,
    `${perRead.toFixed(2)} µs per read`,
  );

  // Making a preset: pick a game, keep the suggested start, create, and land in the editor.
  const maker = await context.newPage();
  await maker.setViewportSize({ width: 1280, height: 900 });
  await maker.goto(`chrome-extension://${extensionId}/studio.html#create`);
  await maker.getByLabel('Find a game').fill('forza horizon 6');
  await maker.locator('.picker-item').first().click();
  // "A genre layout" is chosen until picking the game switches it, so wait for the switch.
  const startsFromGame = await maker
    .locator('.start-option.chosen .start-title')
    .filter({ hasText: 'Forza Horizon 6' })
    .textContent({ timeout: 2000 })
    .catch(() => '');
  if (shots) {
    await mkdir(shotDir, { recursive: true });
    await maker.screenshot({ path: join(shotDir, 'studio-create.png') });
  }
  await maker.getByRole('button', { name: 'Create preset' }).click();
  await maker.waitForURL(/#presets\/user/, { timeout: 4000 }).catch(() => undefined);
  const made = decodeURIComponent(maker.url().split('#presets/')[1] ?? '');
  const { assignments: picks } = await worker.evaluate(() =>
    chrome.storage.sync.get('assignments'),
  );
  check(
    'making a preset for a game starts from that game and sets it for the game',
    made.startsWith('user:') &&
      /Forza Horizon 6/.test(startsFromGame) &&
      picks?.['forza horizon 6'] === made,
    `${startsFromGame} -> ${made}`,
  );
  check('the editor opens with a short guide', await maker.locator('.guide').isVisible());
  if (shots) await maker.screenshot({ path: join(shotDir, 'studio-made.png') });

  // Sliders on your own preset follow a drag, and the new value is saved. This preset
  // starts from Forza with the mouse off, so turning it on also opens the mouse settings.
  const savedPreset = (id) =>
    worker.evaluate(async (key) => {
      const [sync, local] = await Promise.all([
        chrome.storage.sync.get(key),
        chrome.storage.local.get(key),
      ]);
      return sync[key] ?? local[key] ?? null;
    }, `preset:${id}`);
  await maker
    .getByRole('group', { name: 'The mouse moves' })
    .getByRole('button', { name: 'Right stick' })
    .click();
  await maker.waitForTimeout(500);
  const speed = maker.locator('#slider-speed');
  await speed.scrollIntoViewIfNeeded();
  const track = await speed.boundingBox();
  const startValue = Number(await speed.inputValue());
  const thumbX = track.x + (track.width * (startValue - 1)) / 99;
  await maker.mouse.move(thumbX, track.y + track.height / 2);
  await maker.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await maker.mouse.move(thumbX + ((track.x + track.width * 0.85 - thumbX) * i) / 10, track.y + track.height / 2);
  }
  await maker.mouse.up();
  const draggedTo = Number(await speed.inputValue());
  const stored = await until(async () => {
    const p = await savedPreset(made);
    return p?.mouse?.sensitivity === draggedTo && draggedTo !== startValue;
  });
  check('dragging a slider on your own preset moves it and saves it', stored, `${startValue} -> ${draggedTo}`);

  // Binding the scroll wheel to a control must not also scroll the page.
  await maker.evaluate(() => window.scrollTo(0, 0));
  await maker.getByRole('button', { name: /^Add a key for/ }).first().click();
  await maker.mouse.move(640, 450);
  await maker.mouse.wheel(0, 300);
  await maker.waitForTimeout(600);
  const boundWheel = await until(async () => {
    const p = await savedPreset(made);
    return Object.values(p?.bindings ?? {}).some((codes) => codes.includes('WheelDown'));
  });
  check(
    'binding the scroll wheel adds it without scrolling the page',
    boundWheel && (await maker.evaluate(() => window.scrollY)) < 2,
  );

  // Lenis: the wheel glides the page down instead of jumping.
  await maker.evaluate(() => window.scrollTo(0, 0));
  await maker.waitForTimeout(300);
  await maker.mouse.wheel(0, 400);
  const early = await maker.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY)))),
  );
  const settled = await until(async () => (await maker.evaluate(() => scrollY)) >= 390, 3000);
  check(
    'the Studio scrolls smoothly with the wheel',
    (await maker.evaluate(() => document.documentElement.classList.contains('lenis'))) &&
      early < 390 &&
      settled,
    `${Math.round(early)} px two frames in`,
  );

  // A built-in preset locks its sliders and says how to change them.
  await maker.goto(`chrome-extension://${extensionId}/studio.html#presets/layout%3Aaction`);
  const lockedSpeed = maker.locator('#slider-speed');
  await lockedSpeed.waitFor();
  check(
    'built-in presets lock their sliders and offer a copy to edit',
    (await lockedSpeed.isDisabled()) &&
      (await maker.locator('.locked-note').first().isVisible()),
  );

  // Settings: the chosen option's highlight sits under it, and a choice that brings in
  // more settings opens them smoothly.
  await maker.goto(`chrome-extension://${extensionId}/studio.html#settings`);
  const display = maker.getByRole('group', { name: 'Input display' });
  const corner = maker.locator('.reveal').filter({ hasText: 'Display corner' });
  await display.getByRole('button', { name: 'Off' }).click();
  await maker.waitForTimeout(500);
  const closedHeight = (await corner.boundingBox())?.height ?? -1;
  await display.getByRole('button', { name: 'Keys' }).click();
  await maker.waitForTimeout(500);
  const openHeight = (await corner.boundingBox())?.height ?? -1;
  const thumbOnKeys = await display.evaluate((group) => {
    const keys = [...group.querySelectorAll('button')].find((b) => b.textContent === 'Keys');
    const thumb = group.querySelector('.thumb').getBoundingClientRect();
    return Math.abs(thumb.left - keys.getBoundingClientRect().left) < 1;
  });
  check(
    'choices slide their highlight, and Display corner opens when the display is on',
    closedHeight < 1 && openHeight > 30 && thumbOnKeys,
    `closed ${closedHeight}, open ${openHeight}`,
  );

  await worker.evaluate(() => chrome.storage.sync.remove('assignments'));
  await maker.close();

  // Nothing in the Studio spills out of its box, from a wide screen down to a small laptop.
  const layout = await context.newPage();
  const spills = [];
  const views = [
    'welcome',
    'create',
    'presets/game%3Aforza-horizon',
    'presets/layout%3Ashooter',
    'games',
    'settings',
  ];
  for (const width of [1440, 1280, 1024, 860]) {
    await layout.setViewportSize({ width, height: 900 });
    for (const view of views) {
      await layout.goto(`chrome-extension://${extensionId}/studio.html#${view}`);
      await layout.waitForTimeout(300);
      for (const issue of await overflowIssues(layout)) spills.push(`${width} #${view}: ${issue}`);
    }
  }
  check(
    'no text or buttons spill out of their boxes in the Studio',
    !spills.length,
    spills.slice(0, 5).join('; '),
  );
  await layout.close();

  // The popup shows its content at once; the fire builds its shader in the background
  // and fades in when ready.
  const quick = await context.newPage();
  await quick.setViewportSize({ width: 360, height: 560 });
  await quick.goto(`chrome-extension://${extensionId}/popup.html`);
  const content = await until(() => quick.locator('.popup:not(.loading)').count(), 3000);
  const lit = await until(() => quick.locator('.fire.lit').count(), 10000);
  check('the popup opens, and its fire lights up after', !!content && !!lit);
  // The link opens github.com, which tests never load, so only the tab request is checked.
  await quick.evaluate(() => {
    window.openedUrls = [];
    chrome.tabs.create = async (props) => {
      window.openedUrls.push(props.url);
      return {};
    };
  });
  await quick.getByRole('button', { name: 'Report a problem' }).click();
  const reportUrl = await until(() => quick.evaluate(() => window.openedUrls[0]), 2000);
  check(
    'Report a problem opens the bug form with the version filled in',
    /\/issues\/new\?template=bug_report\.yml/.test(reportUrl ?? '') &&
      /version=\d+\.\d+\.\d+/.test(reportUrl ?? ''),
    reportUrl,
  );
  await quick.close();

  if (shots) {
    const studio = await context.newPage();
    await studio.setViewportSize({ width: 1440, height: 960 });
    for (const view of ['welcome', 'presets/game%3Aforza-horizon', 'games', 'settings']) {
      await studio.goto(`chrome-extension://${extensionId}/studio.html#${view}`);
      await studio.waitForTimeout(500);
      await studio.screenshot({
        path: join(shotDir, `studio-${view.split('/')[0]}.png`),
        fullPage: false,
      });
    }
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 560 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(500);
    await popup.screenshot({ path: join(shotDir, 'popup-idle.png') });
    // The popup pointed at the game tab, the way it looks while playing.
    // Without the tabs permission URLs are hidden, so ask each tab's bridge what it plays.
    const gameTab = await worker.evaluate(async () => {
      for (const tab of await chrome.tabs.query({})) {
        const session = await chrome.tabs
          .sendMessage(tab.id, { type: 'get-session' })
          .catch(() => null);
        if (session?.url.includes('/launch/forza')) return tab.id;
      }
      return undefined;
    });
    await popup.setViewportSize({ width: 360, height: 600 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${gameTab}`);
    await popup.waitForTimeout(1200);
    await popup.screenshot({ path: join(shotDir, 'popup-game.png') });
    console.log(`Screenshots in ${shotDir}`);
  }
} finally {
  await context.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
