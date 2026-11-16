import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { inputLabel, type InputCode } from '../core/inputs';
import {
  clonePreset,
  LIMITS,
  MAX_INPUTS_PER_TARGET,
  MAX_LABEL_LENGTH,
  toPresetFile,
  type MouseSettings,
  type Preset,
} from '../core/preset';
import { BUTTONS, TARGET_NAMES, type Button, type Target } from '../core/targets';
import { archetypeName } from '../data/archetypes';
import { GAMES } from '../data/games';
import {
  deletePreset,
  savePreset,
  saveSettings,
  setAssignment,
  type StoredState,
} from '../shared/storage';
import { Glyph, Keycap, Reveal, Segmented, Slider, Switch } from '../ui/components';
import { ControllerView } from '../ui/ControllerView';
import { CurveGraph } from '../ui/CurveGraph';
import { useLayoutMap, usePressedInputs } from '../ui/hooks';
import { copyForEditing, isBuiltinId, TARGET_GROUPS } from '../ui/library';
import { CREATED_KEY } from './CreateView';
import { GamePicker, gameTitle } from './GamePicker';
import { scrollToCenter } from './scroll';
import { navigate } from './Studio';
import { TryIt } from './TryIt';
import { useBindingCapture } from './useBindingCapture';

const SAVE_DELAY_MS = 400;

/** Saves an editable copy of a built-in preset and opens it. */
async function copyToEdit(preset: Preset): Promise<void> {
  const mine = copyForEditing(preset);
  await savePreset(mine);
  navigate(`presets/${encodeURIComponent(mine.id)}`);
}

/** Says why the controls below are locked, with the way to change them. */
function LockedNote({ onCopy }: { onCopy: () => void }) {
  return (
    <div class="locked-note">
      <p>Built-in presets stay as they are.</p>
      <button type="button" class="btn small" onClick={onCopy}>
        Make a copy to edit
      </button>
    </div>
  );
}
const BUTTON_SET = new Set<string>(BUTTONS);

export function PresetEditor({ preset, state }: { preset: Preset; state: StoredState }) {
  const editable = !isBuiltinId(preset.id);
  const layout = useLayoutMap();
  const pressed = usePressedInputs(true);
  const [draft, setDraft] = useState(preset);
  const [savedAt, setSavedAt] = useState(0);
  const [focus, setFocus] = useState<Target | null>(null);
  const [guide, setGuide] = useState(() => sessionStorage.getItem(CREATED_KEY) === preset.id);
  const timer = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    setDraft(preset);
  }, [preset.id]);

  const update = useCallback(
    (change: (draft: Preset) => void) => {
      if (!editable) return;
      setDraft((prev) => {
        const next = clonePreset(prev);
        change(next);
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          void savePreset(next).then(() => setSavedAt(Date.now()));
        }, SAVE_DELAY_MS);
        return next;
      });
    },
    [editable],
  );

  const capture = useBindingCapture((target, code) =>
    update((d) => {
      const list = d.bindings[target] ?? [];
      if (!list.includes(code))
        d.bindings[target] = [...list, code].slice(0, MAX_INPUTS_PER_TARGET);
    }),
  );

  const isDefault = state.settings.defaultPresetId === preset.id;

  return (
    <article class="editor">
      <EditorHeader
        preset={draft}
        editable={editable}
        isDefault={isDefault}
        savedAt={savedAt}
        onRename={(name) => update((d) => (d.name = name))}
      />

      {guide && editable && (
        <div class="guide" role="status">
          <p>
            <b>Your preset is saved.</b> To change a key, click <b>Add key</b> on any row, then
            press the key, mouse button or scroll you want. Click a key to remove it. Changes save
            as you go, and you can test them in <b>Try it</b>.
          </p>
          <button
            class="btn quiet"
            onClick={() => {
              sessionStorage.removeItem(CREATED_KEY);
              setGuide(false);
            }}
          >
            Got it
          </button>
        </div>
      )}

      <div class="editor-grid">
        <section class="panel bindings" aria-label="Controls">
          <h2>Controls</h2>
          {!editable && (
            <p class="dim readonly-note">
              Built-in presets stay as they are. Make a copy to change keys, labels or feel.
            </p>
          )}
          {TARGET_GROUPS.map((group) => {
            // Read-only presets only list what they use, so the layout is easy to scan.
            const targets = editable
              ? group.targets
              : group.targets.filter((t) => draft.bindings[t]?.length);
            if (!targets.length) return null;
            return (
              <div class="group" key={group.name}>
                <h3>{group.name}</h3>
                {targets.map((target) => (
                  <BindingRow
                    key={target}
                    target={target}
                    preset={draft}
                    editable={editable}
                    listening={capture.listening === target}
                    highlighted={focus === target}
                    pressed={pressed}
                    layout={layout}
                    onListen={() => capture.listen(target)}
                    onCancel={capture.cancel}
                    onRemove={(code) =>
                      update((d) => {
                        const left = (d.bindings[target] ?? []).filter((c) => c !== code);
                        if (left.length) d.bindings[target] = left;
                        else delete d.bindings[target];
                      })
                    }
                    onLabel={(label) =>
                      update((d) => {
                        if (label.trim()) d.labels[target] = label.slice(0, MAX_LABEL_LENGTH);
                        else delete d.labels[target];
                      })
                    }
                    onToggle={(on) =>
                      update((d) => {
                        const set = new Set(d.toggles);
                        if (on) set.add(target as Button);
                        else set.delete(target as Button);
                        d.toggles = [...set];
                      })
                    }
                  />
                ))}
              </div>
            );
          })}
        </section>

        <aside class="side">
          <section class="panel">
            <h2>Try it</h2>
            <TryIt preset={draft} />
          </section>
          <UsedFor preset={draft} state={state} />
          <MousePanel
            mouse={draft.mouse}
            editable={editable}
            onCopy={() => void copyToEdit(preset)}
            onChange={(patch) => update((d) => Object.assign(d.mouse, patch))}
          />
          <AnalogPanel
            preset={draft}
            editable={editable}
            update={update}
            onCopy={() => void copyToEdit(preset)}
          />
          <section class="panel">
            <h2>Find a control</h2>
            <p class="dim small">Click a button on the controller to jump to its keys.</p>
            <ControllerView
              selected={focus}
              onPick={(t) => {
                setFocus(t);
                const row = document.getElementById(`row-${t}`);
                if (row) scrollToCenter(row);
              }}
            />
          </section>
        </aside>
      </div>
    </article>
  );
}

/** The games this preset loads for, with a way to add and remove them. */
function UsedFor({ preset, state }: { preset: Preset; state: StoredState }) {
  const picked = Object.entries(state.assignments)
    .filter(([, id]) => id === preset.id)
    .map(([key]) => key);
  const spec = GAMES.find((g) => preset.id === `game:${g.slug}${g.variant ? `:${g.variant}` : ''}`);
  return (
    <section class="panel">
      <h2>Used for</h2>
      {spec && !spec.variant && (
        <p class="dim small">Loads on its own for {spec.titles.join(', ')}.</p>
      )}
      {picked.length > 0 ? (
        <ul class="game-chips">
          {picked.map((key) => (
            <li key={key} class="game-chip">
              <span>{gameTitle(key)}</span>
              <button
                type="button"
                aria-label={`Stop using it for ${gameTitle(key)}`}
                onClick={() => void setAssignment(key, null)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="faint small">
          {spec
            ? 'Add more games to use it for them too.'
            : 'Add a game and this preset loads when you start it.'}
        </p>
      )}
      <GamePicker
        label="Add a game"
        placeholder="Add a game"
        picked={picked}
        onPick={(game) => void setAssignment(game.key, preset.id)}
      />
    </section>
  );
}

function EditorHeader(props: {
  preset: Preset;
  editable: boolean;
  isDefault: boolean;
  savedAt: number;
  onRename: (name: string) => void;
}) {
  const { preset, editable, isDefault } = props;
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [preset.id]);

  const kind = editable
    ? 'Your preset'
    : preset.id.startsWith('game:')
      ? 'Made for this game'
      : 'Genre layout';

  const copy = () => void copyToEdit(preset);

  const download = () => {
    const blob = new Blob([JSON.stringify(toPresetFile(preset), null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${preset.name.replace(/[^\w -]+/g, '').trim() || 'preset'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <header class="editor-head">
      <div class="editor-title">
        <p class="kind faint">
          {kind}
          {preset.archetype &&
            !preset.id.startsWith('layout:') &&
            `, built on the ${archetypeName(preset.archetype)} layout`}
        </p>
        {editable ? (
          <input
            class="name-input wide"
            value={preset.name}
            maxLength={48}
            aria-label="Preset name"
            onInput={(e) => props.onRename((e.target as HTMLInputElement).value)}
          />
        ) : (
          <h1 class="wide">{preset.name}</h1>
        )}
        {preset.notes && <p class="dim">{preset.notes}</p>}
      </div>
      <div class="editor-actions">
        {editable && props.savedAt > 0 && <span class="faint saved">Saved</span>}
        {!editable && (
          <button class="btn primary" onClick={copy}>
            Make a copy to edit
          </button>
        )}
        {editable && (
          <button class="btn" onClick={copy}>
            Duplicate
          </button>
        )}
        {!isDefault && (
          <button
            class="btn quiet"
            onClick={() => void saveSettings({ defaultPresetId: preset.id })}
          >
            Use as default
          </button>
        )}
        {isDefault && <span class="faint">Your default</span>}
        <button class="btn quiet" onClick={download}>
          Export
        </button>
        {editable &&
          (confirmDelete ? (
            <button
              class="btn danger"
              onClick={async () => {
                await deletePreset(preset.id);
                navigate('presets');
              }}
            >
              Delete for good
            </button>
          ) : (
            <button class="btn quiet" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ))}
      </div>
    </header>
  );
}

function BindingRow(props: {
  target: Target;
  preset: Preset;
  editable: boolean;
  listening: boolean;
  highlighted: boolean;
  pressed: ReadonlySet<string>;
  layout: ReturnType<typeof useLayoutMap>;
  onListen: () => void;
  onCancel: () => void;
  onRemove: (code: InputCode) => void;
  onLabel: (label: string) => void;
  onToggle: (on: boolean) => void;
}) {
  const { target, preset, editable } = props;
  const codes = preset.bindings[target] ?? [];
  const label = preset.labels[target] ?? '';
  const isButton = BUTTON_SET.has(target);
  const toggled = preset.toggles.includes(target as Button);

  return (
    <div id={`row-${target}`} class={`binding${props.highlighted ? ' highlighted' : ''}`}>
      <Glyph target={target} />
      <div class="binding-label">
        {editable ? (
          <input
            class="label-input"
            value={label}
            placeholder={TARGET_NAMES[target]}
            maxLength={MAX_LABEL_LENGTH}
            aria-label={`What ${TARGET_NAMES[target]} does`}
            onChange={(e) => props.onLabel((e.target as HTMLInputElement).value)}
          />
        ) : (
          <span>{label || <span class="faint">{TARGET_NAMES[target]}</span>}</span>
        )}
      </div>
      <div class="binding-keys">
        {codes.map((code) =>
          editable ? (
            <button
              key={code}
              class="cap-remove"
              title={`Remove ${inputLabel(code, props.layout)}`}
              onClick={() => props.onRemove(code)}
            >
              <Keycap code={code} layout={props.layout} down={props.pressed.has(code)} />
            </button>
          ) : (
            <Keycap key={code} code={code} layout={props.layout} down={props.pressed.has(code)} />
          ),
        )}
        {!codes.length && !props.listening && <span class="faint">Not bound</span>}
        {editable &&
          (props.listening ? (
            <button class="listening" onClick={props.onCancel}>
              Press a key, click or scroll. Esc cancels.
            </button>
          ) : (
            codes.length < MAX_INPUTS_PER_TARGET && (
              <button
                class="add"
                onClick={props.onListen}
                aria-label={`Add a key for ${TARGET_NAMES[target]}`}
              >
                Add key
              </button>
            )
          ))}
      </div>
      {editable && isButton ? (
        <label class="toggle-cell" title="Press once to hold, again to let go">
          <Switch
            checked={toggled}
            label={`Toggle ${TARGET_NAMES[target]}`}
            onChange={props.onToggle}
          />
          <span class="faint">Toggle</span>
        </label>
      ) : (
        <span class="toggle-cell">{toggled && <span class="faint">Toggle</span>}</span>
      )}
    </div>
  );
}

function MousePanel(props: {
  mouse: MouseSettings;
  editable: boolean;
  onChange: (patch: Partial<MouseSettings>) => void;
  onCopy: () => void;
}) {
  const { mouse, editable, onChange } = props;
  const locked = !editable;
  const set = (patch: Partial<MouseSettings>) => editable && onChange(patch);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <section class="panel">
      <h2>Mouse</h2>
      {!editable && <LockedNote onCopy={props.onCopy} />}
      <Segmented
        label="The mouse moves"
        value={mouse.target}
        disabled={locked}
        options={[
          ['right', 'Right stick'],
          ['left', 'Left stick'],
          ['none', 'Off'],
        ]}
        onChange={(target) => set({ target })}
      />
      <Reveal open={mouse.target !== 'none'}>
        <Segmented
          label="Mouse mode"
          value={mouse.mode}
          disabled={locked}
          options={[
            ['camera', 'Look and aim'],
            ['wheel', 'Steering wheel'],
          ]}
          onChange={(mode) => set({ mode })}
        />
        <p class="dim small">
          {mouse.mode === 'camera'
            ? 'Moving the mouse tilts the stick. Stop and it eases back to center.'
            : 'Side to side movement turns the wheel and it stays where you leave it.'}
        </p>
        <div class="sliders">
          <Slider
            disabled={locked}
            label="Speed"
            value={mouse.sensitivity}
            min={LIMITS.sensitivity[0]}
            max={LIMITS.sensitivity[1]}
            onInput={(v) => set({ sensitivity: v })}
          />
          <Reveal open={mouse.mode === 'camera'}>
            <Slider
              disabled={locked}
              label="Vertical speed"
              value={mouse.yRatio}
              min={0.25}
              max={2}
              step={0.05}
              format={pct}
              onInput={(v) => set({ yRatio: v })}
            />
            <Slider
              disabled={locked}
              label="Smoothing"
              value={mouse.smoothing}
              min={0}
              max={0.9}
              step={0.05}
              format={pct}
              hint="Higher feels steadier, lower feels more direct."
              onInput={(v) => set({ smoothing: v })}
            />
          </Reveal>
          <Reveal open={mouse.mode === 'wheel'}>
            <Slider
              disabled={locked}
              label="Return to center"
              value={mouse.wheelReturn}
              min={0}
              max={1}
              step={0.05}
              format={(v) => (v === 0 ? 'Off' : pct(v))}
              hint="Off keeps the wheel where you leave it."
              onInput={(v) => set({ wheelReturn: v })}
            />
          </Reveal>
          <Slider
            disabled={locked}
            label="Response curve"
            value={mouse.curve}
            min={LIMITS.curve[0]}
            max={LIMITS.curve[1]}
            step={0.05}
            format={(v) => v.toFixed(2)}
            hint="Below 1 gives small movements more effect."
            onInput={(v) => set({ curve: v })}
          />
          <Slider
            disabled={locked}
            label="Dead zone push"
            value={mouse.antiDeadzone}
            min={0}
            max={0.5}
            step={0.01}
            format={pct}
            hint="Raise it if small movements do nothing in the game."
            onInput={(v) => set({ antiDeadzone: v })}
          />
        </div>
        <CurveGraph curve={mouse.curve} antiDeadzone={mouse.antiDeadzone} />
        <Reveal open={mouse.mode === 'camera'}>
          <label class="inline-switch">
            <Switch
              checked={mouse.invertY}
              disabled={locked}
              label="Invert vertical look"
              onChange={(v) => set({ invertY: v })}
            />
            <span>Invert vertical look</span>
          </label>
        </Reveal>
      </Reveal>
    </section>
  );
}

function AnalogPanel(props: {
  preset: Preset;
  editable: boolean;
  update: (change: (d: Preset) => void) => void;
  onCopy: () => void;
}) {
  const { analog } = props.preset;
  const locked = !props.editable;
  const set = (change: (d: Preset) => void) => props.editable && props.update(change);
  const ms = (v: number) => (v === 0 ? 'Instant' : `${v} ms`);
  return (
    <section class="panel">
      <h2>Keys as sticks and triggers</h2>
      {!props.editable && <LockedNote onCopy={props.onCopy} />}
      <p class="dim small">
        Keys are on or off. Ease-in makes a key glide to full instead of snapping, which keeps
        steering smooth. Most of the movement comes right away, so it does not feel late.
      </p>
      <div class="sliders">
        <Slider
          disabled={locked}
          label="Stick ease-in"
          value={analog.stickRampMs}
          min={0}
          max={400}
          step={10}
          format={ms}
          onInput={(v) => set((d) => (d.analog.stickRampMs = v))}
        />
        <Slider
          disabled={locked}
          label="Trigger ease-in"
          value={analog.triggerRampMs}
          min={0}
          max={400}
          step={10}
          format={ms}
          onInput={(v) => set((d) => (d.analog.triggerRampMs = v))}
        />
        <Slider
          disabled={locked}
          label="Precision hold strength"
          value={analog.precision}
          min={LIMITS.precision[0]}
          max={LIMITS.precision[1]}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          hint="How far sticks and triggers go while the precision key is held. Good for sneaking and lockpicking."
          onInput={(v) => set((d) => (d.analog.precision = v))}
        />
      </div>
    </section>
  );
}
