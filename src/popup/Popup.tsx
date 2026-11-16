import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usesMouse, type Preset } from '../core/preset';
import { candidatePresets } from '../core/resolve';
import type { Target } from '../core/targets';
import { TARGET_NAMES } from '../core/targets';
import { BRAND } from '../shared/brand';
import type { SessionInfo, ToBridge } from '../shared/messages';
import { problemReportUrl } from '../shared/report';
import {
  loadRecent,
  loadStats,
  saveSettings,
  setAssignment,
  setNativePreference,
  updateStats,
  type RecentGame,
  type Stats,
  type StoredState,
} from '../shared/storage';
import { Glyph, KeyList, Slider, Switch, Wordmark } from '../ui/components';
import { FireBorder } from '../ui/FireBorder';
import { useLayoutMap, usePressedInputs, useStoredState } from '../ui/hooks';
import { editPreset, presetMap, REASON_TEXT, TARGET_GROUPS } from '../ui/library';

const POLL_MS = 1000;
const REVIEW_AFTER_SESSIONS = 5;

async function activeTabId(): Promise<number | undefined> {
  // ?tab= points the popup at a given tab, so tests can open it as a page.
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  if (forced) return forced;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function askBridge<T>(message: ToBridge): Promise<T | null> {
  const id = await activeTabId();
  if (id === undefined) return null;
  try {
    return ((await chrome.tabs.sendMessage(id, message)) as T) ?? null;
  } catch {
    return null;
  }
}

function useSession(): SessionInfo | null | undefined {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      askBridge<SessionInfo>({ type: 'get-session' }).then((s) => alive && setSession(s));
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return session;
}

export function Popup() {
  const state = useStoredState();
  const session = useSession();
  const layout = useLayoutMap();

  if (!state || session === undefined) return <div class="popup loading" aria-busy="true" />;

  // The fire burns with the controller: full while playing, low when idle, embers when off.
  const playing = session?.mode === 'emulate' && session.page?.kind === 'stream';
  const power = !state.settings.enabled ? 0 : playing ? 1 : 0.55;

  return (
    <div class="popup">
      {state.settings.fire && <FireBorder power={power} ghost={state.settings.flame === 'ghost'} />}
      <Header state={state} />
      {session?.game ? (
        <GamePanel state={state} session={session} layout={layout} />
      ) : (
        <IdlePanel state={state} onXbox={!!session} />
      )}
      <Footer session={session} state={state} />
    </div>
  );
}

function Header({ state }: { state: StoredState }) {
  return (
    <header class="top">
      <img src="icons/128.png" width="30" height="30" alt="" />
      <h1 class="brand">
        <Wordmark />
      </h1>
      <Switch
        checked={state.settings.enabled}
        label={state.settings.enabled ? `Turn ${BRAND.name} off` : `Turn ${BRAND.name} on`}
        onChange={(enabled) => void saveSettings({ enabled })}
      />
    </header>
  );
}

function GamePanel(props: {
  state: StoredState;
  session: SessionInfo;
  layout: ReturnType<typeof useLayoutMap>;
}) {
  const { state, session, layout } = props;
  const game = session.game!;
  const presets = useMemo(() => presetMap(state), [state]);
  const preset = presets.get(session.presetId);
  const ctx = {
    presets,
    assignments: state.assignments,
    defaultPresetId: state.settings.defaultPresetId,
    autoDetect: state.settings.autoDetect,
  };
  const options = candidatePresets(game, ctx, state.presets);
  const assigned = state.assignments[game.key];

  return (
    <main class="game">
      <section class="title-block">
        <h1 class="game-title wide">{game.title}</h1>
        <p class="dim status">
          <span class={session.status.active ? 'status-dot live' : 'status-dot'} />
          {statusLine(session, preset)}
        </p>
      </section>

      {session.mode === 'native' && (
        <section class="note">
          <p>This game supports mouse and keyboard on its own, so {BRAND.name} is standing by.</p>
          <button class="btn" onClick={() => void setNativePreference(game.key, 'emulate')}>
            Use {BRAND.name} instead
          </button>
        </section>
      )}

      {session.mode !== 'native' && (
        <>
          <section class="preset-pick">
            <label for="preset" class="label">
              Preset <span class="faint">{REASON_TEXT[session.reason]}</span>
            </label>
            <select
              id="preset"
              class="select"
              value={assigned ?? ''}
              onChange={(e) => {
                const value = (e.target as HTMLSelectElement).value;
                void setAssignment(game.key, value || null);
              }}
            >
              <option value="">
                Automatic ({presets.get(autoId(game, ctx))?.name ?? 'default'})
              </option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {state.nativePrefs[game.key] === 'emulate' && (
              <button class="link" onClick={() => void setNativePreference(game.key, null)}>
                Go back to the game's own mouse support
              </button>
            )}
          </section>

          {preset && preset.mouse.target !== 'none' && (
            <MouseSpeed preset={preset} gameKey={game.key} />
          )}
          {preset && <KeySheet preset={preset} layout={layout} />}
        </>
      )}
    </main>
  );
}

function autoId(
  game: NonNullable<SessionInfo['game']>,
  ctx: Parameters<typeof candidatePresets>[1],
): string {
  if (!ctx.autoDetect) return ctx.defaultPresetId;
  return game.tunedIds[0] ?? `layout:${game.archetype}`;
}

function statusLine(session: SessionInfo, preset: Preset | undefined): string {
  if (session.mode === 'off') return session.paused ? 'Paused for this tab' : 'Turned off';
  if (session.mode === 'native') return 'Using the game’s own mouse and keyboard';
  if (session.page?.kind !== 'stream') return 'Starts when you launch the game';
  if (session.status.handedOff) return 'A controller is in use. Press a key to switch back';
  if (session.status.captured) return 'Mouse captured. Esc lets go';
  if (preset && !usesMouse(preset)) return 'This preset plays with keys only';
  return 'Click the game to use your mouse';
}

function MouseSpeed({ preset, gameKey }: { preset: Preset; gameKey: string }) {
  const [value, setValue] = useState(preset.mouse.sensitivity);
  const timer = useRef(0);
  useEffect(() => setValue(preset.mouse.sensitivity), [preset.id, preset.mouse.sensitivity]);
  const commit = (next: number) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void editPreset(preset, (draft) => (draft.mouse.sensitivity = next), gameKey);
    }, 350);
  };
  return (
    <section class="speed">
      <Slider
        label={preset.mouse.mode === 'wheel' ? 'Steering speed' : 'Mouse speed'}
        value={value}
        min={1}
        max={100}
        onInput={commit}
        hint={
          preset.id.startsWith('user:')
            ? undefined
            : 'Changing this saves a copy of the preset for this game.'
        }
      />
    </section>
  );
}

function KeySheet({ preset, layout }: { preset: Preset; layout: ReturnType<typeof useLayoutMap> }) {
  const pressed = usePressedInputs(true);
  const groups = TARGET_GROUPS.map((group) => ({
    name: group.name,
    targets: group.targets.filter((t) => preset.bindings[t]?.length),
  })).filter((group) => group.targets.length);
  const edit = () =>
    void chrome.tabs.create({
      url: chrome.runtime.getURL(`studio.html#presets/${encodeURIComponent(preset.id)}`),
    });
  return (
    <section class="sheet">
      <h2 class="label">
        Keys
        <button class="link" onClick={edit}>
          Edit keys
        </button>
      </h2>
      <div class="sheet-grid">
        {groups.map((group) => (
          <Fragment key={group.name}>
            <h3 class="sheet-group">{group.name}</h3>
            {group.targets.map((target: Target) => {
              const codes = preset.bindings[target] ?? [];
              const down = codes.some((c) => pressed.has(c));
              return (
                <div key={target} class={down ? 'sheet-row down' : 'sheet-row'}>
                  <KeyList codes={codes} layout={layout} pressed={pressed} small />
                  <Glyph target={target} />
                  <span class="sheet-what">{preset.labels[target] ?? TARGET_NAMES[target]}</span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      {preset.notes && <p class="notes dim">{preset.notes}</p>}
    </section>
  );
}

function IdlePanel({ state, onXbox }: { state: StoredState; onXbox: boolean }) {
  const [recent, setRecent] = useState<RecentGame[]>([]);
  const presets = useMemo(() => presetMap(state), [state]);
  useEffect(() => void loadRecent().then(setRecent), []);
  return (
    <main class="idle">
      <section class="title-block">
        <h1 class="game-title wide">{onXbox ? 'Pick a game' : 'No game open'}</h1>
        <p class="dim">
          {onXbox
            ? 'Launch any game and its keys load on their own.'
            : `Start a game on Xbox Cloud Gaming and ${BRAND.name} loads the keys for it.`}
        </p>
        {!onXbox && (
          <button
            class="btn primary"
            onClick={() => void chrome.tabs.create({ url: 'https://www.xbox.com/play' })}
          >
            Open Xbox Cloud Gaming
          </button>
        )}
      </section>

      {recent.length > 0 && (
        <section class="recent">
          <h2 class="label">Played recently</h2>
          <ul>
            {recent.slice(0, 5).map((g) => {
              const pick = state.assignments[g.key];
              return (
                <li key={g.key}>
                  <span class="recent-title">{g.title}</span>
                  <span class="faint">{pick ? presets.get(pick)?.name : 'Automatic'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <ReviewPrompt />
    </main>
  );
}

function ReviewPrompt() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => void loadStats().then(setStats), []);
  if (!stats || stats.reviewPrompt !== 'pending' || stats.sessions < REVIEW_AFTER_SESSIONS)
    return null;
  const close = (reviewPrompt: Stats['reviewPrompt']) => {
    void updateStats({ reviewPrompt });
    setStats({ ...stats, reviewPrompt });
  };
  return (
    <section class="review">
      <p>If {BRAND.name} works well for you, a rating helps other players find it.</p>
      <div class="review-actions">
        <a
          class="btn"
          href={BRAND.storeUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => close('done')}
        >
          Rate it
        </a>
        <button class="btn quiet" onClick={() => close('dismissed')}>
          Not now
        </button>
      </div>
    </section>
  );
}

function Footer({ session, state }: { session: SessionInfo | null; state: StoredState }) {
  const report = () => {
    const preset = session ? presetMap(state).get(session.presetId)?.name : undefined;
    const url = problemReportUrl({
      version: chrome.runtime.getManifest().version,
      userAgent: navigator.userAgent,
      game: session?.game?.title,
      preset,
    });
    void chrome.tabs.create({ url });
  };
  return (
    <footer class="bottom">
      <button class="btn" onClick={() => void chrome.runtime.openOptionsPage()}>
        Open the Studio
      </button>
      <div class="bottom-links">
        <button class="link" onClick={report}>
          Report a problem
        </button>
        <button
          class="link"
          onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Shortcuts
        </button>
      </div>
    </footer>
  );
}
