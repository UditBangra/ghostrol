import { useMemo, useRef, useState } from 'preact/hooks';
import { fromPresetFile, type Preset } from '../core/preset';
import { ARCHETYPE_IDS } from '../data/archetypes';
import { GAMES } from '../data/games';
import { newPresetId, savePreset, type StoredState } from '../shared/storage';
import { isBuiltinId, presetMap } from '../ui/library';
import { PresetEditor } from './PresetEditor';
import { navigate } from './Studio';

export function PresetsView({
  state,
  selectedId,
}: {
  state: StoredState;
  selectedId?: string | undefined;
}) {
  const presets = useMemo(() => presetMap(state), [state]);
  const selected =
    (selectedId && presets.get(selectedId)) ||
    presets.get(state.settings.defaultPresetId) ||
    presets.get('layout:action')!;
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const tuned = GAMES.map((g) =>
    presets.get(`game:${g.slug}${g.variant ? `:${g.variant}` : ''}`),
  ).filter((p): p is Preset => !!p);
  const layouts = ARCHETYPE_IDS.map((id) => presets.get(`layout:${id}`)).filter(
    (p): p is Preset => !!p,
  );

  const importFile = async (file: File) => {
    setError('');
    try {
      const preset = fromPresetFile(JSON.parse(await file.text()));
      if (!preset) throw new Error('bad file');
      if (isBuiltinId(preset.id) || presets.has(preset.id)) preset.id = newPresetId();
      await savePreset(preset);
      navigate(`presets/${encodeURIComponent(preset.id)}`);
    } catch {
      setError('That file is not a preset. Export one from here to see the format.');
    }
  };

  return (
    <div class="presets">
      <aside class="preset-list" aria-label="Presets">
        <div class="list-actions">
          <a class="btn primary" href="#create">
            New preset
          </a>
          <button class="btn quiet" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) void importFile(file);
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </div>
        {error && <p class="error">{error}</p>}
        <PresetGroup
          title="Yours"
          presets={state.presets}
          selected={selected.id}
          empty="Copies you make and presets you import show up here."
        />
        <PresetGroup title="Made for games" presets={tuned} selected={selected.id} />
        <PresetGroup title="Genre layouts" presets={layouts} selected={selected.id} />
      </aside>
      <PresetEditor key={selected.id} preset={selected} state={state} />
    </div>
  );
}

function PresetGroup(props: {
  title: string;
  presets: readonly Preset[];
  selected: string;
  empty?: string;
}) {
  return (
    <section class="preset-group">
      <h2>{props.title}</h2>
      {props.presets.length === 0 && props.empty && <p class="faint small">{props.empty}</p>}
      <ul>
        {props.presets.map((p) => (
          <li key={p.id}>
            <a
              href={`#presets/${encodeURIComponent(p.id)}`}
              aria-current={p.id === props.selected ? 'true' : undefined}
            >
              {p.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
